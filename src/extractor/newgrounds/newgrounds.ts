import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  matchId,
  progressiveFormat,
} from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?:www\.)?newgrounds\.com\/portal\/view\/(?<id>\d+)/i;

interface NewgroundsSource {
  src?: string;
}

interface NewgroundsVideoJson {
  title?: string;
  author?: string;
  sources?: Record<string, NewgroundsSource[]>;
  image?: string;
  duration?: number;
}

export class NewgroundsIE extends InfoExtractor {
  static IE_NAME = "newgrounds";
  static IE_DESC = "Newgrounds portal";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — quality source arrays`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const id = matchId(url, VALID_URL);
    // Warm cookies / age-gate state before the JSON endpoint.
    await this.request.text(url, {
      headers: { Accept: "text/html,application/xhtml+xml" },
    });
    const json = await this.request.json<NewgroundsVideoJson>(
      `https://www.newgrounds.com/portal/video/${id}`,
      {
        headers: {
          Accept: "application/json, text/javascript, */*; q=0.01",
          Referer: url,
          "X-Requested-With": "XMLHttpRequest",
        },
      },
    );

    const formats: Format[] = [];
    for (const [formatId, sources] of Object.entries(json.sources || {})) {
      const height = Number.parseInt(formatId, 10);
      for (const source of sources || []) {
        if (!source.src) continue;
        formats.push(
          progressiveFormat(source.src, {
            format_id: formatId,
            height: Number.isFinite(height) ? height : null,
          }),
        );
      }
    }

    if (!formats.length) throw new Error(`No playable formats for Newgrounds ${id}`);

    return baseInfo("newgrounds", url, {
      id,
      title: json.title || id,
      uploader: json.author || null,
      thumbnail: json.image,
      duration: json.duration ?? null,
      formats,
    });
  }
}
