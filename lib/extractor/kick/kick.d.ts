import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { InfoDict } from "../../core/types";
export declare class KickIE extends InfoExtractor {
    static IE_NAME: string;
    static IE_DESC: string;
    static readonly _VALID_URL: RegExp;
    static getInfo(): ExtractorInfo;
    extract(url: string): Promise<InfoDict>;
    private extractVod;
    private extractClip;
}
//# sourceMappingURL=kick.d.ts.map