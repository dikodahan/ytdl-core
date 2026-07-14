import { InfoExtractor } from "../../core/info-extractor";
import type { InfoDict } from "../../core/types";
export declare class BunnyCdnIE extends InfoExtractor {
    static IE_NAME: string;
    static IE_DESC: string;
    static readonly _VALID_URL: RegExp;
    extract(url: string): Promise<InfoDict>;
}
//# sourceMappingURL=bunnycdn.d.ts.map