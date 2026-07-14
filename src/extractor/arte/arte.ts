import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  hlsFormat,
  progressiveFormat,
} from "../_shared/helpers";

const LANGS = "fr|de|en|es|it|pl";
const VALID_URL = new RegExp(
  `^(?:https?:\\/\\/(?:(?:www\\.)?arte\\.tv\\/(?<lang>${LANGS})\\/videos|api\\.arte\\.tv\\/api\\/player\\/v\\d+\\/config\\/(?<lang_2>${LANGS}))|arte:\\/\\/program)\\/(?<id>\\d{6}-\\d{3}-[AF]|LIVE)`,
  "i",
);

const API_BASE = "https://api.arte.tv/api/player/v2";

const COUNTRIES_MAP: Record<string, string[]> = {
  DE_FR: ["DE", "FR"],
  EUR_DE_FR: ["AT", "CH", "DE", "FR"],
  SAT: ["DE", "FR", "GB", "IT", "ES", "PL"],
};

interface ArteStream {
  protocol?: string;
  url?: string;
  versions?: Array<{ label?: string; shortLabel?: string; eStat?: { ml5?: string } }>;
}

interface ArteConfig {
  data?: {
    attributes?: {
      restriction?: { geoblocking?: { restrictedArea?: boolean; code?: string } };
      rights?: unknown;
      streams?: ArteStream[];
      metadata?: {
        providerId?: string;
        title?: string;
        subtitle?: string;
        description?: string;
        duration?: { seconds?: number };
        images?: Array<{ url?: string }>;
        link?: { url?: string };
      };
      live?: boolean;
    };
  };
}

export class ArteIE extends InfoExtractor {
  static IE_NAME = "arte";
  static IE_DESC = "Arte.tv";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — HLS / progressive`,
      validUrl: String(this._VALID_URL),
      options: [],
      notes: "May be geo-restricted depending on rights territory.",
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const m = url.match(VALID_URL);
    const videoId = m?.groups?.id;
    const lang = m?.groups?.lang || m?.groups?.lang_2 || "en";
    if (!videoId) throw new Error(`Could not extract id from URL: ${url}`);

    const config = await this.request.json<ArteConfig>(
      `${API_BASE}/config/${lang}/${videoId}`,
      { headers: { "x-validated-age": "18" } },
    );

    const attrs = config.data?.attributes;
    const geo = attrs?.restriction?.geoblocking;
    if (geo?.restrictedArea) {
      const code = geo.code || "DE_FR";
      const countries = (COUNTRIES_MAP[code] || ["DE", "FR"]).join(", ");
      throw new Error(`Arte video is geo-restricted to ${code} (${countries})`);
    }
    if (!attrs?.rights) {
      throw new Error(
        "Arte video is not available in this language edition or broadcast rights expired",
      );
    }

    const formats: Format[] = [];
    for (const stream of attrs.streams || []) {
      if (!stream.url) continue;
      const version = stream.versions?.[0];
      const verCode = version?.eStat?.ml5 || "unknown";
      const note = version?.label || version?.shortLabel || verCode;
      if (stream.protocol && /HLS/i.test(stream.protocol)) {
        formats.push(hlsFormat(stream.url, `hls-${verCode}`));
        formats[formats.length - 1]!.format_note = note;
      } else if (stream.protocol === "HTTPS" || stream.protocol === "RTMP") {
        formats.push(
          progressiveFormat(stream.url, {
            format_id: `${stream.protocol}-${verCode}`,
            format_note: note,
          }),
        );
      }
    }

    if (!formats.length) {
      throw new Error(`Arte ${videoId} has no playable streams`);
    }

    const meta = attrs.metadata || {};
    return baseInfo("arte", url, {
      id: meta.providerId || videoId,
      title: meta.subtitle || meta.title || videoId,
      description: meta.description || null,
      duration: meta.duration?.seconds ?? null,
      thumbnail: meta.images?.[0]?.url,
      is_live: attrs.live || false,
      formats,
    });
  }
}
