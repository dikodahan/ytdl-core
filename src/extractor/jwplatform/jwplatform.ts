import { InfoExtractor } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  dashFormat,
  hlsFormat,
  matchId,
  progressiveFormat,
} from "../_shared/helpers";

interface JwSource {
  file?: string;
  type?: string;
  width?: number;
  height?: number;
  label?: string;
}

interface JwPlaylistItem {
  title?: string;
  description?: string;
  image?: string;
  duration?: number;
  sources?: JwSource[];
}

interface JwMediaResponse {
  title?: string;
  description?: string;
  playlist?: JwPlaylistItem[];
}

export class JWPlatformIE extends InfoExtractor {
  static IE_NAME = "jwplatform";
  static IE_DESC = "JW Player / JW Platform CDN embeds";
  static readonly _VALID_URL =
    /(?:https?:\/\/(?:content\.jwplatform|cdn\.jwplayer)\.com\/(?:(?:feed|player|thumb|preview|manifest)s|jw6|v2\/media)\/|jwplatform:)(?<id>[a-zA-Z0-9]{8})/i;

  async extract(url: string): Promise<InfoDict> {
    const id = matchId(url, JWPlatformIE._VALID_URL);
    const data = await this.request.json<JwMediaResponse>(
      `https://cdn.jwplayer.com/v2/media/${id}`,
    );
    const item = data.playlist?.[0] || {};
    const formats: Format[] = [];

    for (const source of item.sources || []) {
      const file = source.file;
      if (!file) continue;
      const type = (source.type || "").toLowerCase();
      if (type.includes("mpegurl") || /\.m3u8(\?|$)/i.test(file)) {
        formats.push(hlsFormat(file));
      } else if (type.includes("dash") || /\.mpd(\?|$)/i.test(file)) {
        formats.push(dashFormat(file));
      } else {
        formats.push(
          progressiveFormat(file, {
            format_id: source.label || "http",
            width: source.width ?? null,
            height: source.height ?? null,
          }),
        );
      }
    }

    if (!formats.length) {
      throw new Error(`JW Platform media ${id} has no playable sources`);
    }

    return baseInfo(JWPlatformIE.IE_NAME, url, {
      id,
      title: item.title || data.title || id,
      description: item.description || data.description || null,
      thumbnail: item.image,
      duration: item.duration ?? null,
      formats,
    });
  }
}
