import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { CategoryListResult } from "../../core/category-list";
import type { ListVideosOptions, VideoListResult } from "../../core/video-list";
import type { InfoDict } from "../../core/types";
import { KALTURA_OTT_PRESETS, resolvePartnerPreset } from "./presets";
export declare class KalturaOttIE extends InfoExtractor {
    static IE_NAME: string;
    static IE_DESC: string;
    static readonly _VALID_URL: RegExp;
    static getInfo(): ExtractorInfo;
    static suitable(url: string): boolean;
    static listUrlSupported(url: string): boolean;
    private resolvePreset;
    private client;
    private credentials;
    private epgDays;
    extract(url: string): Promise<InfoDict>;
    private extractLive;
    private extractProgram;
    listVideos(url: string, options?: ListVideosOptions): Promise<VideoListResult>;
    listCategories(url?: string, options?: {
        limit?: number;
    }): Promise<CategoryListResult>;
}
export { KALTURA_OTT_PRESETS, resolvePartnerPreset };
//# sourceMappingURL=kaltura-ott.d.ts.map