import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { InfoDict } from "../../core/types";
import type { ListVideosOptions, VideoListResult } from "../../core/video-list";
import type { CategoryListResult } from "../../core/category-list";
export declare class YouPornIE extends InfoExtractor {
    static IE_NAME: string;
    static IE_DESC: string;
    static readonly _VALID_URL: RegExp;
    static getInfo(): ExtractorInfo;
    static listUrlSupported(url: string): boolean;
    private listingUrl;
    private setAgeVerifiedCookie;
    private parsePlayerVars;
    private remoteFormats;
    private buildFormats;
    extract(url: string): Promise<InfoDict>;
    listVideos(url: string, options?: ListVideosOptions): Promise<VideoListResult>;
    listCategories(url?: string, options?: {
        limit?: number;
    }): Promise<CategoryListResult>;
}
//# sourceMappingURL=youporn.d.ts.map