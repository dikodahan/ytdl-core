import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { InfoDict } from "../../core/types";
export declare class FoxNewsIE extends InfoExtractor {
    static IE_NAME: string;
    static IE_DESC: string;
    private static readonly _PATTERNS;
    static suitable(url: string): boolean;
    static getInfo(): ExtractorInfo;
    private fetchAmpFeed;
    private extractEmbedVideoId;
    extract(url: string): Promise<InfoDict>;
}
//# sourceMappingURL=foxnews.d.ts.map