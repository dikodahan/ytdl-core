import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  matchId,
  progressiveFormat,
} from "../_shared/helpers";

const VALID_URL =
  /^(?:coub:|https?:\/\/(?:coub\.com\/(?:view|embed|coubs)\/|c-cdn\.coub\.com\/fb-player\.swf\?.*\bcoub(?:ID|id)=))(?<id>[\da-z]+)/i;

interface CoubHtml5Item {
  url?: string;
  size?: number;
}

interface CoubFileVersions {
  html5?: {
    video?: Record<string, CoubHtml5Item>;
    audio?: Record<string, CoubHtml5Item>;
  };
  iphone?: { url?: string };
  mobile?: { audio_url?: string };
}

interface CoubJson {
  error?: string;
  title?: string;
  picture?: string;
  duration?: number;
  file_versions?: CoubFileVersions;
  channel?: { title?: string; permalink?: string };
  age_restricted?: boolean;
  age_restricted_by_admin?: boolean;
}

export class CoubIE extends InfoExtractor {
  static IE_NAME = "coub";
  static IE_DESC = "Coub";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — html5 video urls`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const id = matchId(url, VALID_URL);
    const coub = await this.request.json<CoubJson>(
      `https://coub.com/api/v2/coubs/${id}.json`,
    );
    if (coub.error) throw new Error(`coub said: ${coub.error}`);

    const formats: Format[] = [];
    const html5 = coub.file_versions?.html5 || {};
    for (const kind of ["video", "audio"] as const) {
      const items = html5[kind];
      if (!items || typeof items !== "object") continue;
      for (const [quality, item] of Object.entries(items)) {
        if (!item?.url) continue;
        formats.push(
          progressiveFormat(item.url, {
            format_id: `html5-${kind}-${quality}`,
            filesize: item.size ?? null,
            has_video: kind === "video",
            has_audio: kind === "audio",
            vcodec: kind === "audio" ? "none" : "unknown",
            acodec: kind === "video" ? "none" : "unknown",
          }),
        );
      }
    }

    const iphoneUrl = coub.file_versions?.iphone?.url;
    if (iphoneUrl) {
      formats.push(progressiveFormat(iphoneUrl, { format_id: "iphone" }));
    }

    if (!formats.length) throw new Error(`No playable formats for Coub ${id}`);

    return baseInfo("coub", url, {
      id,
      title: coub.title || id,
      uploader: coub.channel?.title || null,
      uploader_id: coub.channel?.permalink || null,
      thumbnail: coub.picture,
      duration: coub.duration ?? null,
      formats,
    });
  }
}
