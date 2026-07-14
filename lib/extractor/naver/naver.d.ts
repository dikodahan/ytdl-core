import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { InfoDict } from "../../core/types";
export declare class NaverIE extends InfoExtractor {
    static IE_NAME: string;
    static IE_DESC: string;
    static readonly _VALID_URL: RegExp;
    static getInfo(): ExtractorInfo;
    private callPlayInfoApi;
    private formatsFromPlay;
    extract(url: string): Promise<InfoDict>;
}
//# sourceMappingURL=naver.d.ts.map