import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { CategoryListResult } from "../../core/category-list";
import type { ListVideosOptions, VideoListResult } from "../../core/video-list";
import type { InfoDict } from "../../core/types";
export declare class LiveNewsNowIE extends InfoExtractor {
    static IE_NAME: string;
    static IE_DESC: string;
    static readonly _VALID_URL: RegExp;
    static getInfo(): ExtractorInfo;
    static suitable(url: string): boolean;
    static listUrlSupported(url: string): boolean;
    extract(url: string): Promise<InfoDict>;
    listVideos(url: string, options?: ListVideosOptions): Promise<VideoListResult>;
    listCategories(_url?: string, options?: {
        limit?: number;
    }): Promise<CategoryListResult>;
    private resolveListCategory;
    private entryFromChannel;
    private infoFromStream;
}
export { LNN_ORIGIN, LNN_HOME_URL, extractSignedStreamUrl, unescapeJsString } from "./client";
//# sourceMappingURL=livenewsnow.d.ts.map