import type { RequestClient } from "../../networking/request";
export declare const GBNEWS_ORIGIN = "https://www.gbnews.com";
export declare const GBNEWS_LIVE_URL = "https://www.gbnews.com/watch/live";
export declare const GBNEWS_CHANNELS_URL = "https://www.gbnews.com/watch/live";
export declare const PERCEPTION_ORIGIN = "https://gbnews.perception.tv";
export declare const PERCEPTION_CLIENT_ID = "2114590823908139151";
/** Signing secret embedded in perception.min.js (`ve.Rt`). */
export declare const PERCEPTION_CLIENT_SECRET = "2409d1da-0384-4a5e-b52c-142fe28eaf41";
export declare const PERCEPTION_API_VERSION = "11.10";
export declare const PERCEPTION_API_FORMAT = "json";
/** Default channel currently embedded as `player/tv/385` on watch/live. */
export declare const PERCEPTION_DEFAULT_CHANNEL_ID = "385";
export declare const HLS_CLIENT_PARAMS = "client=hlsjs&version=v1.6.15-Fora2&v=6&initialBandwidthLimit=2097153";
export interface GbnewsChannel {
    /** Perception channel id (e.g. `385`). */
    id: string;
    /** Channel slug: gbn1 / gbn2 / live / live-2 */
    slug: string;
    title: string;
    pageUrl: string;
    thumbnail: string | null;
}
export interface GbnewsStreamInfo {
    channelId: string;
    streamUrl: string;
    title: string;
    thumbnail: string | null;
    pageUrl: string;
}
export declare function normalizeGbnewsChannelId(raw: string): string;
export declare function gbnewsChannelPageUrl(slugOrId: string): string;
/** Append browser-equivalent HLS client query params required for playback. */
export declare function withHlsClientParams(streamUrl: string): string;
export declare function perceptionCall<T>(request: RequestClient, action: string, payload: Record<string, unknown>): Promise<T>;
export declare function createPerceptionSession(request: RequestClient): Promise<{
    sessionId: string;
    segmentDuration: number;
    numberOfSegmentsForLive: number;
}>;
/** Resolve a playable Perception HLS URL (includes `mwk` token). */
export declare function fetchPerceptionStreamUrl(request: RequestClient, channelId: string | number): Promise<string>;
export declare function listPerceptionChannels(request: RequestClient): Promise<Array<{
    id: string;
    title: string;
    number: number | null;
}>>;
/** Parse Perception channel id / legacy player attrs from a watch page. */
export declare function parseGbnewsPlayerConfig(html: string): {
    channelId: string | null;
    thumbnail: string | null;
    title: string | null;
};
/** Discover GBN 1 / GBN 2 entries from the live watch page markup. */
export declare function parseGbnewsChannelsHtml(html: string, pageUrl?: string): GbnewsChannel[];
export declare function discoverGbnewsChannels(request: RequestClient): Promise<GbnewsChannel[]>;
export declare function resolveGbnewsChannel(request: RequestClient, channelRef: string): Promise<GbnewsChannel>;
/** @deprecated Prefer fetchPerceptionStreamUrl — kept as alias for callers. */
export declare function fetchGbnewsStreamUrl(request: RequestClient, channelId: string, _key?: string, _playerId?: string): Promise<string>;
export declare function extractGbnewsLiveFromPage(request: RequestClient, pageUrl: string): Promise<GbnewsStreamInfo>;
//# sourceMappingURL=client.d.ts.map