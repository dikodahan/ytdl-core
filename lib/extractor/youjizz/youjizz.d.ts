import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { InfoDict } from "../../core/types";
import type { ListVideosOptions, VideoListResult } from "../../core/video-list";
export declare class YouJizzIE extends InfoExtractor {
    static IE_NAME: string;
    static IE_DESC: string;
    static readonly _VALID_URL: RegExp;
    static getInfo(): ExtractorInfo;
    static listUrlSupported(url: string): boolean;
    private listingUrl;
    extract(url: string): Promise<InfoDict>;
    listVideos(url: string, options?: ListVideosOptions): Promise<VideoListResult>;
}
//# sourceMappingURL=youjizz.d.ts.map