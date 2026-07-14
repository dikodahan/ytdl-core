import { InfoExtractor } from "../../core/info-extractor";
import type { InfoDict } from "../../core/types";
export declare class BrightcoveIE extends InfoExtractor {
    static IE_NAME: string;
    static IE_DESC: string;
    static readonly _VALID_URL: RegExp;
    extract(url: string): Promise<InfoDict>;
    private extractPolicyKey;
    private parseSources;
}
//# sourceMappingURL=brightcove.d.ts.map