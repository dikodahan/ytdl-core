import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  dashFormat,
  extractBetween,
  extractJsonObject,
  hlsFormat,
  matchId,
  progressiveFormat,
  searchJsonAssignment,
  tryParseJson,
} from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?:(?:www|player)\.)?vimeo\.com\/(?:video\/)?(?<id>\d+)/i;

interface VimeoConfig {
  video?: {
    id?: number | string;
    title?: string;
    duration?: number;
    owner?: { name?: string };
    thumbs?: Record<string, string>;
    thumbnail?: string;
    files?: ConfigFiles;
  };
  request?: { files?: ConfigFiles };
}

interface ConfigFiles {
  progressive?: Array<{
    url?: string;
    quality?: string;
    width?: number;
    height?: number;
    fps?: number;
    bitrate?: number;
  }>;
  hls?: { cdns?: Record<string, { url?: string }> };
  dash?: { cdns?: Record<string, { url?: string }> };
}

export class VimeoIE extends InfoExtractor {
  static IE_NAME = "vimeo";
  static IE_DESC = "Vimeo";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — progressive + HLS`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  private formatsFromConfig(config: VimeoConfig): Format[] {
    const files = config.video?.files || config.request?.files || {};
    const formats: Format[] = [];

    for (const f of files.progressive || []) {
      if (!f.url) continue;
      formats.push(
        progressiveFormat(f.url, {
          format_id: `http-${f.quality || "progressive"}`,
          width: f.width ?? null,
          height: f.height ?? null,
          fps: f.fps ?? null,
          tbr: f.bitrate ?? null,
        }),
      );
    }

    for (const [cdn, data] of Object.entries(files.hls?.cdns || {})) {
      if (data.url) formats.push(hlsFormat(data.url, `hls-${cdn}`));
    }
    for (const [cdn, data] of Object.entries(files.dash?.cdns || {})) {
      let url = data.url;
      if (!url) continue;
      if (url.includes("json=1")) {
        // leave as-is; VLC may not play dash json — convert master.json → master.mpd
        url = url.replace("/master.json", "/master.mpd");
      }
      formats.push(dashFormat(url, `dash-${cdn}`));
    }

    return formats;
  }

  private findConfigInPage(webpage: string): VimeoConfig | null {
    const clipped = extractBetween(webpage, "window.playerConfig = ", ";");
    if (clipped) {
      const parsed = tryParseJson<VimeoConfig>(clipped);
      if (parsed) return parsed;
    }

    const assign = searchJsonAssignment(
      webpage,
      /(?:var\s+)?(?:config|playerConfig)\s*=\s*/,
    ) as VimeoConfig | null;
    if (assign?.request || assign?.video) return assign;

    const dataConfig = webpage.match(/data-config-url="([^"]+)"/);
    if (dataConfig?.[1]) {
      return { request: { files: {} }, video: { id: "" } }; // marker handled by caller via config_url
    }

    const idx = webpage.indexOf('"request":');
    if (idx >= 0) {
      const brace = webpage.lastIndexOf("{", idx);
      if (brace >= 0) {
        const obj = extractJsonObject(webpage, brace) as VimeoConfig | null;
        if (obj?.request || obj?.video) return obj;
      }
    }
    return null;
  }

  async extract(url: string): Promise<InfoDict> {
    const id = matchId(url, VALID_URL);
    const playerUrl = `https://player.vimeo.com/video/${id}`;
    const webpage = await this.request.text(playerUrl, {
      headers: { Referer: "https://vimeo.com/" },
    });

    let config: VimeoConfig | null = this.findConfigInPage(webpage);

    const configUrl =
      webpage.match(/data-config-url="([^"]+)"/)?.[1] ||
      webpage.match(/"config_url"\s*:\s*"([^"]+)"/)?.[1]?.replace(/\\u0026/g, "&").replace(/\\\//g, "/");

    if ((!config || !config.request?.files) && configUrl) {
      config = await this.request.json<VimeoConfig>(configUrl.replace(/&amp;/g, "&"), {
        headers: { Referer: playerUrl },
      });
    }

    // Also try config embedded as JSON in script
    if (!config) {
      const embed = extractBetween(webpage, "var config = ", ";");
      if (embed) config = tryParseJson<VimeoConfig>(embed);
    }

    if (!config) throw new Error(`Unable to extract Vimeo config for ${id}`);

    const formats = this.formatsFromConfig(config);
    if (!formats.length) {
      throw new Error(
        `No playable formats for Vimeo ${id} (may require login or embed referer)`,
      );
    }

    const thumbs = config.video?.thumbs || {};
    const thumb =
      thumbs.base || thumbs["1280"] || thumbs["640"] || Object.values(thumbs)[0] ||
      config.video?.thumbnail;

    return baseInfo("vimeo", url, {
      id,
      title: config.video?.title || `Vimeo ${id}`,
      duration: config.video?.duration ?? null,
      uploader: config.video?.owner?.name || null,
      thumbnail: thumb,
      formats,
    });
  }
}
