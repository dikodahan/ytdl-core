import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { InfoDict } from "../../core/types";
/**
 * Fallback extractor — must be registered last.
 * Matches any URL and scrapes obvious media (OG / JSON-LD / HTML5).
 */
export declare class GenericIE extends InfoExtractor {
    static IE_NAME: string;
    static IE_DESC: string;
    static readonly _VALID_URL: RegExp;
    static getInfo(): ExtractorInfo;
    extract(url: string): Promise<InfoDict>;
}
//# sourceMappingURL=generic.d.ts.map