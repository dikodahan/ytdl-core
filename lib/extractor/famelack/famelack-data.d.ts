import type { CategoryListEntry } from "../_shared/page-links";
import type { VideoListEntry } from "../../core/video-list";
import type { RequestClient } from "../../networking/request";
export declare const FAMELACK_DATA_ROOT = "https://raw.githubusercontent.com/famelack/famelack-data/main/tv/raw";
export declare const FAMELACK_TV_CATEGORIES: readonly ["animation", "auto", "business", "classic", "comedy", "cooking", "culture", "documentary", "education", "entertainment", "family", "general", "interactive", "kids", "legislative", "lifestyle", "movies", "music", "news", "outdoor", "public", "relax", "religious", "science", "series", "shop", "show", "sports", "top-news", "travel", "weather"];
export interface RawFamelackChannel {
    nanoid: string;
    name?: string;
    sources?: {
        streams?: string[];
        youtube?: string[];
    };
    languages?: string[];
    country?: string;
    isGeoBlocked?: boolean;
}
export interface FamelackChannel {
    nanoid: string;
    name: string;
    country: string | null;
    languages: string[];
    streamUrls: string[];
    youtubeUrls: string[];
    isGeoBlocked: boolean;
}
export interface FamelackCountryMeta {
    country: string;
    capital?: string;
    timeZone?: string;
    hasChannels?: boolean;
    channelCount?: number;
}
export declare function isCountryScope(scope: string): boolean;
export declare function channelPageUrl(scope: string, nanoid: string): string;
export declare function listingPageUrl(scope: string): string;
export declare function normalizeChannel(raw: RawFamelackChannel): FamelackChannel;
export declare function youtubeWatchUrls(channel: FamelackChannel): string[];
export declare function fetchCountriesMetadata(request: RequestClient): Promise<Record<string, FamelackCountryMeta>>;
export declare function fetchScopeChannels(request: RequestClient, scope: string): Promise<RawFamelackChannel[]>;
export declare function findChannel(request: RequestClient, scope: string, nanoid: string): Promise<FamelackChannel | null>;
export declare function channelsToListEntries(channels: RawFamelackChannel[], scope: string): VideoListEntry[];
export declare function buildCountryCategories(request: RequestClient): Promise<CategoryListEntry[]>;
export declare function buildTvCategoryIndex(): CategoryListEntry[];
//# sourceMappingURL=famelack-data.d.ts.map