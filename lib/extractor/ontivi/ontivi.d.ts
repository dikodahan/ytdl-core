import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { CategoryListResult } from "../../core/category-list";
import type { ListVideosOptions, VideoListResult } from "../../core/video-list";
import type { InfoDict } from "../../core/types";
export declare class OntiviIE extends InfoExtractor {
    static IE_NAME: string;
    static IE_DESC: string;
    static readonly _VALID_URL: RegExp;
    static getInfo(): ExtractorInfo;
    static listUrlSupported(url: string): boolean;
    extract(url: string): Promise<InfoDict>;
    listVideos(url: string, options?: ListVideosOptions): Promise<VideoListResult>;
    listCategories(url?: string, options?: {
        limit?: number;
    }): Promise<CategoryListResult>;
    /**
     * Follow Ontivi's gate playlist redirect to an absolute playable m3u8.
     * Gate URLs look like `https://s.ontivi.net/{id}/index.m3u8?k=…` and 302 to
     * `/{22-char-token}/{id}/{epoch}/index.m3u8` (relative Location). Returning the
     * gate URL breaks some players that mishandle relative redirects.
     */
    private resolvePlayableHls;
    private loadPlayerConfig;
}
//# sourceMappingURL=ontivi.d.ts.map