import { InfoExtractor, type ExtractorInfo, type InfoExtractorConstructor } from "../../core/info-extractor";
import type { InfoDict, YoutubeDLParams } from "../../core/types";
import type { RequestClient } from "../../networking/request";
import { extractWebpageMedia } from "../_shared/webpage-media";

export interface GeneratedCatalogEntry {
  id: string;
  ieClass?: string;
  ieName?: string;
  description: string;
  patterns: string[];
  hosts: string[];
  module?: string;
  source?: string;
}

function compilePatterns(entry: GeneratedCatalogEntry): RegExp[] {
  const out: RegExp[] = [];
  for (const src of entry.patterns || []) {
    try {
      out.push(new RegExp(src, "i"));
    } catch {
      /* skip broken conversions */
    }
  }
  if (!out.length && entry.hosts?.length) {
    const hostAlt = entry.hosts.map(h => h.replace(/\./g, "\\.")).join("|");
    out.push(new RegExp(`^https?:\\/\\/(?:[\\w-]+\\.)*(?:${hostAlt})(?:[/?#]|$)`, "i"));
  }
  return out;
}

export function createGeneratedExtractor(entry: GeneratedCatalogEntry): InfoExtractorConstructor {
  const compiled = compilePatterns(entry);
  const patterns = compiled.length ? compiled : [/(?!)/];

  class GeneratedIE extends InfoExtractor {
    static IE_NAME = entry.id;
    static IE_DESC = entry.description;
    static readonly _VALID_URL = patterns[0]!;
    private static readonly _PATTERNS = patterns;

    static suitable(url: string): boolean {
      return this._PATTERNS.some(re => re.test(url));
    }

    static getInfo(): ExtractorInfo {
      return {
        name: this.IE_NAME,
        description: this.IE_DESC,
        validUrl: patterns.map(String).join(" | "),
        options: [],
        status: "partial",
      };
    }

    constructor(params: YoutubeDLParams, request: RequestClient) {
      super(params, request);
    }

    async extract(url: string): Promise<InfoDict> {
      return extractWebpageMedia(this.request, url, entry.id);
    }
  }

  Object.defineProperty(GeneratedIE, "name", { value: `${entry.id}GeneratedIE` });
  return GeneratedIE as unknown as InfoExtractorConstructor;
}
