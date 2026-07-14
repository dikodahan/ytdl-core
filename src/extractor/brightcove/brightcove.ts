import { InfoExtractor } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  dashFormat,
  extractBetween,
  hlsFormat,
  progressiveFormat,
  tryParseJson,
} from "../_shared/helpers";

interface BrightcoveSource {
  src?: string;
  streaming_src?: string;
  type?: string;
  container?: string;
  avg_bitrate?: number;
  size?: number;
  width?: number;
  height?: number;
}

interface BrightcoveVideo {
  id?: string;
  name?: string;
  description?: string | null;
  duration?: number;
  poster?: string;
  thumbnail?: string;
  sources?: BrightcoveSource[];
  errors?: Array<{ message?: string; error_code?: string; error_subcode?: string }>;
}

export class BrightcoveIE extends InfoExtractor {
  static IE_NAME = "brightcove";
  static IE_DESC = "Brightcove players (Video Cloud)";
  static readonly _VALID_URL =
    /https?:\/\/players\.brightcove\.net\/(?<account>\d+)\/(?<player>[^/]+)_(?<embed>[^/]+)\/index\.html\?.*?(?:video|playlist)Id=(?<id>\d+|ref:[^&]+)/i;

  async extract(url: string): Promise<InfoDict> {
    const m = url.match(BrightcoveIE._VALID_URL);
    if (!m?.groups) throw new Error(`Could not extract Brightcove ids from URL: ${url}`);

    const { account, player, embed, id } = m.groups;
    const contentType = /playlistId=/i.test(url) ? "playlist" : "video";
    if (contentType === "playlist") {
      throw new Error("Brightcove playlists are not supported in VLC-video mode; use a videoId URL");
    }

    const policyKey = await this.extractPolicyKey(account, player, embed, id);
    const apiUrl = `https://edge.api.brightcove.com/playback/v1/accounts/${account}/videos/${id}`;
    const data = await this.request.json<BrightcoveVideo>(apiUrl, {
      headers: {
        Accept: `application/json;pk=${policyKey}`,
      },
    });

    if (data.errors?.length) {
      const err = data.errors[0];
      throw new Error(err.message || err.error_code || "Brightcove playback error");
    }

    const formats = this.parseSources(data.sources || []);
    if (!formats.length) {
      throw new Error(`Brightcove video ${id} has no playable sources`);
    }

    return baseInfo(BrightcoveIE.IE_NAME, url, {
      id: String(data.id || id),
      title: data.name || id,
      description: data.description ?? null,
      duration: data.duration != null ? data.duration / 1000 : null,
      thumbnail: data.poster || data.thumbnail,
      formats,
      uploader_id: account,
    });
  }

  private async extractPolicyKey(
    account: string,
    player: string,
    embed: string,
    videoId: string,
  ): Promise<string> {
    const base = `https://players.brightcove.net/${account}/${player}_${embed}/`;
    try {
      const config = await this.request.json<{
        video_cloud?: { policy_key?: string };
      }>(`${base}config.json`);
      if (config.video_cloud?.policy_key) return config.video_cloud.policy_key;
    } catch {
      /* fall through to index.min.js */
    }

    const js = await this.request.text(`${base}index.min.js`);
    const catalogRaw = extractBetween(js, "catalog(", ");");
    if (catalogRaw) {
      const catalog = tryParseJson<{ policyKey?: string }>(
        catalogRaw.replace(/(\w+)\s*:/g, '"$1":').replace(/'/g, '"'),
      );
      if (catalog?.policyKey) return catalog.policyKey;
    }

    const pk =
      js.match(/policyKey\s*:\s*["']([^"']+)["']/)?.[1] ||
      js.match(/"policyKey"\s*:\s*"([^"]+)"/)?.[1];
    if (!pk) {
      throw new Error(`Could not extract Brightcove policyKey for video ${videoId}`);
    }
    return pk;
  }

  private parseSources(sources: BrightcoveSource[]): Format[] {
    const formats: Format[] = [];
    for (const source of sources) {
      const src = source.src || source.streaming_src;
      if (!src) continue;
      const container = (source.container || "").toUpperCase();
      const type = (source.type || "").toLowerCase();
      if (type.includes("mpegurl") || container === "M2TS" || /\.m3u8(\?|$)/i.test(src)) {
        formats.push(hlsFormat(src));
      } else if (type.includes("dash") || /\.mpd(\?|$)/i.test(src)) {
        formats.push(dashFormat(src));
      } else if (/^https?:/i.test(src)) {
        const isAudio = source.width === 0 && source.height === 0;
        formats.push(
          progressiveFormat(src, {
            format_id: "http",
            width: source.width ?? null,
            height: source.height ?? null,
            tbr: source.avg_bitrate != null ? source.avg_bitrate / 1000 : null,
            filesize: source.size ?? null,
            has_video: !isAudio,
            vcodec: isAudio ? "none" : "unknown",
          }),
        );
      }
    }
    return formats;
  }
}
