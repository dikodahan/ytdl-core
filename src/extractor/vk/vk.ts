import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  dashFormat,
  hlsFormat,
  progressiveFormat,
  tryParseJson,
} from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?:(?:(?:m|new|vksport)\.)?vk(?:(?:video)?\.ru|\.com)\/(?:.+?\?.*?z=)?(?:video|clip)|(?:www\.)?daxab\.com\/embed\/)(?<videoid>-?\d+_\d+)/i;

interface VkPlayerParams {
  md_title?: string;
  md_author?: string;
  description?: string;
  jpg?: string;
  author_id?: string | number;
  authorId?: string | number;
  duration?: number;
  live?: number;
  [key: string]: unknown;
}

interface VkMvData {
  title?: string;
  desc?: string;
  duration?: number;
}

export class VKIE extends InfoExtractor {
  static IE_NAME = "vk";
  static IE_DESC = "VK";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — al_video.php act=show progressive/HLS`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  private async downloadPayload(
    path: string,
    data: Record<string, string | number>,
  ): Promise<unknown[]> {
    const endpoint = `https://vk.com/${path}.php`;
    const body = new URLSearchParams({
      ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      al: "1",
    }).toString();

    const res = await this.request.request(endpoint, {
      method: "POST",
      headers: {
        Referer: endpoint,
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (/\/challenge\.html/i.test(res.body) || res.statusCode === 429) {
      throw new Error(
        "vk: received a JS challenge / rate-limit response — open the video in a browser or retry later",
      );
    }

    const json = tryParseJson<{ payload?: [string, ...unknown[]] }>(res.body);
    if (!json?.payload) {
      throw new Error("vk: unexpected al_video payload (login may be required)");
    }

    const [code, ...rest] = json.payload;
    if (code === "3") {
      throw new Error("vk: login required to access this video");
    }
    if (code === "8") {
      const msg = Array.isArray(rest[0]) ? String((rest[0] as unknown[])[0] ?? "") : String(rest[0] ?? "");
      throw new Error(`vk: ${msg.replace(/<[^>]+>/g, "").slice(0, 200) || "request failed"}`);
    }
    return rest;
  }

  private formatsFromPlayer(data: VkPlayerParams): Format[] {
    const formats: Format[] = [];
    for (const [formatId, value] of Object.entries(data)) {
      const formatUrl = typeof value === "string" ? value : null;
      if (!formatUrl || !/^(?:https?:|\/\/|rtmp)/i.test(formatUrl)) continue;
      const absolute = formatUrl.startsWith("//") ? `https:${formatUrl}` : formatUrl;

      if (
        formatId.startsWith("url") ||
        formatId.startsWith("cache") ||
        formatId === "extra_data" ||
        formatId === "live_mp4" ||
        formatId === "postlive_mp4"
      ) {
        const height = Number(formatId.match(/^(?:url|cache)(\d+)/)?.[1]) || null;
        formats.push(
          progressiveFormat(absolute, {
            format_id: formatId,
            height,
          }),
        );
      } else if (formatId.startsWith("hls") && formatId !== "hls_live_playback") {
        formats.push(hlsFormat(absolute, formatId));
      } else if (formatId.startsWith("dash") && formatId !== "dash_live_playback" && formatId !== "dash_uni") {
        formats.push(dashFormat(absolute, formatId));
      }
    }
    return formats;
  }

  async extract(url: string): Promise<InfoDict> {
    const m = url.match(VALID_URL);
    const videoId = m?.groups?.videoid;
    if (!videoId) throw new Error(`Could not extract id from URL: ${url}`);

    let infoPage = "";
    let player: { params?: VkPlayerParams[] } = {};
    let mvData: VkMvData = {};

    try {
      const payload = await this.downloadPayload("al_video", {
        act: "show",
        video: videoId,
      });
      infoPage = typeof payload[0] === "string" ? payload[0] : "";
      const opts = (payload[payload.length - 1] || {}) as {
        mvData?: VkMvData;
        player?: { params?: VkPlayerParams[] };
      };
      mvData = opts.mvData || {};
      player = opts.player || {};
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/login|challenge/i.test(msg)) throw err;
      // Soft-fail path: try video_ext embed page
      infoPage = await this.request.text(
        `https://vk.com/video_ext.php?oid=${videoId.split("_")[0]}&id=${videoId.split("_")[1]}`,
      );
      if (/challenge\.html|act=security_check|Please log in/i.test(infoPage)) {
        throw new Error("vk: login or security check required for this video");
      }
      const paramsMatch = infoPage.match(/var\s+playerParams\s*=\s*(\{.+?\})\s*;\s*\n/s);
      if (paramsMatch?.[1]) {
        player = tryParseJson(paramsMatch[1]) || {};
      }
    }

    const data = player.params?.[0];
    if (!data) {
      throw new Error(
        `vk: no player params for ${videoId} (deleted, private, or login required)`,
      );
    }

    const formats = this.formatsFromPlayer(data);
    if (!formats.length) {
      throw new Error(`vk: no playable url*/hls* formats for ${videoId}`);
    }

    return baseInfo("vk", url, {
      id: videoId,
      title: mvData.title || data.md_title || videoId,
      description: mvData.desc || data.description || null,
      duration: mvData.duration ?? data.duration ?? null,
      uploader: data.md_author || null,
      uploader_id:
        data.author_id != null
          ? String(data.author_id)
          : data.authorId != null
            ? String(data.authorId)
            : null,
      thumbnail: typeof data.jpg === "string" ? data.jpg : undefined,
      formats,
      http_headers: { Referer: "https://vk.com/" },
    });
  }
}
