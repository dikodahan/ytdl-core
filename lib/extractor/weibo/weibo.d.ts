import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { InfoDict } from "../../core/types";
export declare class WeiboIE extends InfoExtractor {
    static IE_NAME: string;
    static IE_DESC: string;
    static readonly _VALID_URL: RegExp;
    static getInfo(): ExtractorInfo;
    private updateVisitorCookies;
    private downloadStatusJson;
    private formatsFromMedia;
    private parseVideoInfo;
    extract(url: string): Promise<InfoDict>;
}
//# sourceMappingURL=weibo.d.ts.map