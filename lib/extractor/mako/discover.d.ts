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
    source: "site" | "fallback";
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
 * Prefer site discovery exclusively when it returns any channels.
 * MediaBox / built-in list is used only when site discovery fails or is empty.
 */
export declare function selectMakoCatalog(siteChannels: MakoChannel[], fallback?: MakoChannel[]): {
    channels: MakoChannel[];
    source: "site" | "fallback";
};
/** @deprecated Use {@link selectMakoCatalog}. Kept for callers expecting a flat list. */
export declare function mergeMakoCatalog(siteChannels: MakoChannel[], fallback?: MakoChannel[]): MakoChannel[];
/** True when a tokenized Mako HLS playlist is reachable. */
export declare function isMakoStreamPlayable(request: RequestClient, streamUrl: string, tokenUrl?: string): Promise<boolean>;
/** Drop catalog entries whose CDN paths are dead (used for MediaBox fallback only). */
export declare function filterDeadFallbackChannels(request: RequestClient, channels: MakoChannel[]): Promise<MakoChannel[]>;
/** Cached site catalog, or MediaBox fallback when discovery fails. */
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