import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { InfoDict } from "../../core/types";
export declare class RumbleIE extends InfoExtractor {
    static IE_NAME: string;
    static IE_DESC: string;
    static readonly _VALID_URL: RegExp;
    static getInfo(): ExtractorInfo;
    private resolveEmbedId;
    extract(url: string): Promise<InfoDict>;
}
//# sourceMappingURL=rumble.d.ts.map