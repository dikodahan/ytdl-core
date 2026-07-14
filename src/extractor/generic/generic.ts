import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { InfoDict } from "../../core/types";
import { extractWebpageMedia } from "../_shared/webpage-media";

/**
 * Fallback extractor — must be registered last.
 * Matches any URL and scrapes obvious media (OG / JSON-LD / HTML5).
 */
export class GenericIE extends InfoExtractor {
  static IE_NAME = "generic";
  static IE_DESC = "Generic webpage media scrape (fallback)";
  static readonly _VALID_URL = /.*/;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: this.IE_DESC,
      validUrl: String(this._VALID_URL),
      options: [],
      status: "ready",
    };
  }

  async extract(url: string): Promise<InfoDict> {
    return extractWebpageMedia(this.request, url, "generic");
  }
}
