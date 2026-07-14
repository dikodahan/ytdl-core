import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { InfoDict } from "../../core/types";
export declare class SoundcloudIE extends InfoExtractor {
    static IE_NAME: string;
    static IE_DESC: string;
    static readonly _VALID_URL: RegExp;
    static getInfo(): ExtractorInfo;
    private scrapeClientId;
    extract(url: string): Promise<InfoDict>;
}
//# sourceMappingURL=soundcloud.d.ts.map