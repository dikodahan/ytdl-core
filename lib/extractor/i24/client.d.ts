import type { RequestClient } from "../../networking/request";
export declare const I24_VIDEO_ORIGIN = "https://video.i24news.tv";
export declare const I24_API_BASE = "https://insight-api-shared.univtec.com/";
export declare const I24_TENANT_ID = "i24israel";
export declare const I24_REGIONS_URL = "https://video.i24news.tv/regions";
export interface I24RegionInfo {
    regionCode: string;
    displayName: string;
    regionImage?: string;
    pageId: string;
    pageUrl: string;
}
export interface I24LiveChannel {
    id: string;
    title: string;
    videoUrl: string;
    thumbnail?: string | null;
    regionCode: string;
}
interface I24ConfigPage {
    _id: string;
    name?: string;
    main?: boolean;
    sections?: Array<{
        id: string;
        title?: string;
    }>;
}
interface I24ConfigResponse {
    displayName?: string;
    config?: {
        pages?: I24ConfigPage[];
        features?: {
            regions?: {
                regions?: Array<{
                    regionCode: string;
                    displayName?: string;
                    regionImage?: string;
                }>;
            };
        };
    };
}
interface I24SectionItem {
    id?: string;
    title?: string;
    name?: string;
    videoUrl?: string;
    thumbnail?: string;
    image?: string;
    poster?: string;
}
interface I24SectionResponse {
    title?: string;
    items?: I24SectionItem[];
}
declare const DEFAULT_HEADERS: Record<string, string>;
export { DEFAULT_HEADERS as I24_REQUEST_HEADERS };
export declare function fetchI24Config(request: RequestClient, regionCode: string): Promise<I24ConfigResponse>;
export declare function fetchI24Section(request: RequestClient, sectionId: string, regionCode: string): Promise<I24SectionResponse>;
export declare function fetchI24Channel(request: RequestClient, channelId: string, regionCode?: string): Promise<{
    id: string;
    title: string;
    videoUrl: string;
    thumbnail?: string | null;
}>;
export declare function i24RegionPageUrl(regionCode: string, pageId: string): string;
export declare function i24ChannelPageUrl(channelId: string): string;
/** Discover region landing pages from the Univtec config (regions picker). */
export declare function discoverI24Regions(request: RequestClient): Promise<I24RegionInfo[]>;
/** Live linear channels exposed on a region's home / live sections. */
export declare function discoverI24LiveChannels(request: RequestClient, regionCode: string): Promise<I24LiveChannel[]>;
/** Prefer the channel whose title matches the region language, else first. */
export declare function pickPrimaryLiveChannel(channels: I24LiveChannel[], regionCode: string): I24LiveChannel | undefined;
//# sourceMappingURL=client.d.ts.map