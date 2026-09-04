import type { RequestClient } from "../../networking/request";
export declare const AJ_NETWORK_ORIGIN = "https://network.aljazeera.net";
export declare const AJ_CHANNELS_URL = "https://network.aljazeera.net/en/channels";
export interface AjChannelInfo {
    id: string;
    title: string;
    pageUrl: string;
    thumbnail: string | null;
    /** Live page used for stream extraction, when known. */
    liveUrl: string | null;
}
/** Broadcast / streamable channel IDs → live watch pages. */
export declare const AJ_CHANNEL_LIVE_URLS: Record<string, string>;
/** Short aliases for `aljazeera:{alias}` pseudo-URLs. */
export declare const AJ_CHANNEL_ALIASES: Record<string, string>;
export interface AjGraphqlVideo {
    id?: string;
    accountId?: string;
    playerId?: string;
    name?: string;
    duration?: string;
}
export declare function ajChannelPageUrl(channelId: string): string;
export declare function normalizeAjChannelId(raw: string): string;
export declare function resolveAjLiveUrl(channelId: string): string | null;
export declare function wpSiteForHost(host: string): string;
export declare function postTypeFromPathType(typePath: string | undefined): string;
/** Discover channel IDs from network.aljazeera.net/{en|ar}/channels. */
export declare function parseAjChannelsHtml(html: string, listUrl?: string): AjChannelInfo[];
export declare function discoverAjChannels(request: RequestClient): Promise<AjChannelInfo[]>;
export declare function findBrightcovePlayerUrl(html: string): string | null;
export declare function findYoutubeVideoId(html: string): string | null;
export declare function fetchAjArticleVideo(request: RequestClient, pageUrl: string, displayId: string, pathType: string | undefined): Promise<{
    title: string | null;
    video: AjGraphqlVideo | null;
    webpage: string | null;
}>;
export declare function brightcoveUrlFromVideo(video: AjGraphqlVideo): string;
//# sourceMappingURL=client.d.ts.map