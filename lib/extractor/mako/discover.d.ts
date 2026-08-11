import type { RequestClient } from "../../networking/request";
import { type MakoChannel } from "./channels";
export interface MakoSiteListingEntry {
    pageUrl: string;
    title?: string;
    itemVcmId?: string;
}
interface CachedCatalog {
    at: number;
    channels: MakoChannel[];
    source: "site+fallback" | "fallback";
}
/** Collect unique `/mako-vod-live-tv/...` cards from CMS JSON. */
export declare function collectLiveTvEntries(root: unknown): MakoSiteListingEntry[];
export declare function stableIdForSiteChannel(opts: {
    pageUrl: string;
    streamUrl?: string;
    title?: string;
}): string;
export declare function groupForChannel(id: string, streamUrl: string): MakoChannel["group"];
/** Discover live/linear channels from mako.co.il VOD CMS (no MediaBox). */
export declare function discoverMakoChannelsFromSite(request: RequestClient): Promise<MakoChannel[]>;
/**
 * Site catalog first; MediaBox / built-in list fills any missing ids
 * (e.g. dancing, ninja, alternate k12 path variants).
 */
export declare function mergeMakoCatalog(siteChannels: MakoChannel[], fallback?: MakoChannel[]): MakoChannel[];
/** Cached merge of site discovery + MediaBox fallback. */
export declare function getMakoCatalog(request: RequestClient, options?: {
    forceRefresh?: boolean;
    group?: MakoChannel["group"];
}): Promise<{
    channels: MakoChannel[];
    source: CachedCatalog["source"];
}>;
export declare function findInMakoCatalog(channels: MakoChannel[], id: string): MakoChannel | undefined;
/** Test helper — clear discovery cache. */
export declare function clearMakoDiscoveryCache(): void;
export {};
//# sourceMappingURL=discover.d.ts.map