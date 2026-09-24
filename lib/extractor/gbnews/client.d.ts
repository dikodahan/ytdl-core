import type { RequestClient } from "../../networking/request";
export declare const GBNEWS_ORIGIN = "https://www.gbnews.com";
export declare const GBNEWS_LIVE_URL = "https://www.gbnews.com/watch/live";
export declare const GBNEWS_CHANNELS_URL = "https://www.gbnews.com/watch/live";
/** Default Simplestream player credentials embedded on gbnews.com watch pages. */
export declare const GBNEWS_DEFAULT_KEY = "3Li3Nt2Qs8Ct3Xq9Fi5Uy0Mb2Bj0Qs";
export declare const GBNEWS_DEFAULT_PLAYER_ID = "GB005";
export declare const SS_PLAYER_API = "https://mm-v2.simplestream.com/ssmp/api.php";
export declare const SS_STREAMS_HOST_FALLBACK = "https://v2-streams-elb.simplestreamcdn.com";
export interface GbnewsChannel {
    /** Stable extract id (Simplestream uvid, or slug when uvid unknown). */
    id: string;
    /** Channel slug: gbn1 / gbn2 / live / live-2 */
    slug: string;
    title: string;
    pageUrl: string;
    uvid: string;
    playerId: string;
    key: string;
    thumbnail: string | null;
}
export interface GbnewsStreamInfo {
    uvid: string;
    streamUrl: string;
    title: string;
    thumbnail: string | null;
    pageUrl: string;
}
export declare function normalizeGbnewsChannelId(raw: string): string;
export declare function gbnewsChannelPageUrl(slugOrId: string): string;
/** Parse Simplestream player attributes from a watch page. */
export declare function parseGbnewsPlayerConfig(html: string): {
    uvid: string | null;
    playerId: string | null;
    key: string | null;
    thumbnail: string | null;
    title: string | null;
};
/** Discover GBN 1 / GBN 2 entries from the live watch page markup. */
export declare function parseGbnewsChannelsHtml(html: string, pageUrl?: string): GbnewsChannel[];
export declare function discoverGbnewsChannels(request: RequestClient): Promise<GbnewsChannel[]>;
interface SsPlayerSettings {
    api_hostname?: string;
    player_external_id?: string;
    player_name?: string;
}
export declare function fetchGbnewsPlayerSettings(request: RequestClient, playerId?: string): Promise<SsPlayerSettings>;
export declare function fetchGbnewsStreamUrl(request: RequestClient, uvid: string, key?: string, playerId?: string): Promise<string>;
export declare function resolveGbnewsChannel(request: RequestClient, channelRef: string): Promise<GbnewsChannel>;
export declare function extractGbnewsLiveFromPage(request: RequestClient, pageUrl: string): Promise<GbnewsStreamInfo>;
export {};
//# sourceMappingURL=client.d.ts.map