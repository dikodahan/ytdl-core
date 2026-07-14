import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import { baseInfo, progressiveFormat } from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?:www\.)?soundgasm\.net\/u\/(?<user>[0-9a-zA-Z_-]+)\/(?<display_id>[0-9a-zA-Z_-]+)/i;

export class SoundgasmIE extends InfoExtractor {
  static IE_NAME = "soundgasm";
  static IE_DESC = "Soundgasm audio";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — progressive m4a`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const m = url.match(VALID_URL);
    if (!m?.groups?.display_id) throw new Error(`Could not extract id from URL: ${url}`);
    const displayId = m.groups.display_id;
    const user = m.groups.user;

    const webpage = await this.request.text(url);
    const audioMatch = webpage.match(/m4a\s*:\s*(["'])(?<url>(?:(?!\1).)+)\1/s);
    const audioUrl = audioMatch?.groups?.url;
    if (!audioUrl) throw new Error(`Could not find m4a URL on Soundgasm page ${displayId}`);

    const title =
      webpage.match(/<div[^>]+\bclass=["']jp-title[^>]+>([^<]+)/i)?.[1]?.trim() || displayId;
    const description =
      webpage.match(/<div[^>]+\bclass=["']jp-description[^>]+>([\s\S]+?)<\/div>/i)?.[1]
        ?.replace(/<[^>]+>/g, "")
        .trim() ||
      webpage.match(/<li>Description:\s*([\s\S]*?)<\/li>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() ||
      null;
    const audioId = audioUrl.match(/\/([^/]+)\.m4a/i)?.[1] || displayId;

    const formats: Format[] = [
      progressiveFormat(audioUrl, {
        format_id: "http",
        ext: "m4a",
        has_video: false,
        vcodec: "none",
        acodec: "m4a",
      }),
    ];

    return baseInfo("soundgasm", url, {
      id: audioId,
      display_id: displayId,
      title,
      description,
      uploader: user || null,
      formats,
    });
  }
}
