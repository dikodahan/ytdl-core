import type { RequestClient } from "../../networking/request";
export type PartnerConfidence = "verified" | "likely" | "guess";
export interface PartnerDiscoveryHit {
    partnerId: number;
    confidence: PartnerConfidence;
    source: string;
    apiHost?: string;
    loginPath?: string;
    apiVersion?: string;
    lineupId?: number;
    channelCount?: number;
    applicationName?: string;
    sampleUrl: string;
}
export declare const PARTNER_ID_SCAN_MIN = 1000;
export declare const PARTNER_ID_SCAN_MAX = 9999;
export interface DiscoverKalturaOttOptions {
    /**
     * When true, briefly sample the partner-ID range (capped by deepScanLimit).
     * Prefer `scanKalturaOttPartnerIds` / a discovery job for a full 1000–9999 scan.
     */
    deepScan?: boolean;
    /** Max login probes during inline deep scan (default 120). */
    deepScanLimit?: number;
}
export interface ScanKalturaOttPartnerIdsOptions {
    from?: number;
    to?: number;
    /** Called after each probe (and after known-hint probes). */
    onProgress?: (progress: {
        currentId: number;
        probed: number;
        total: number;
        hit: PartnerDiscoveryHit | null;
    }) => void | Promise<void>;
    /** Return true to abort the scan early (e.g. user stop). */
    shouldStop?: () => boolean;
}
export interface ScanKalturaOttPartnerIdsResult {
    applicationName: string;
    hit: PartnerDiscoveryHit | null;
    probed: number;
    total: number;
    from: number;
    to: number;
    stoppedEarly: boolean;
    elapsedMs: number;
    notes: string[];
}
export interface DiscoverKalturaOttResult {
    ok: boolean;
    /** Android applicationId / package FQDN that was queried. */
    applicationName: string;
    /** @deprecated Alias of applicationName for older clients. */
    inputUrl: string;
    hits: PartnerDiscoveryHit[];
    candidates: number[];
    probesAttempted: number;
    elapsedMs: number;
    notes: string[];
}
export declare function normalizeAndroidApplicationName(raw: string): string;
export declare function discoverKalturaOttPartner(request: RequestClient, applicationNameOrUrl: string, options?: DiscoverKalturaOttOptions): Promise<DiscoverKalturaOttResult>;
/** True when anonymousLogin (and optional serveByDevice) produced a usable partner hit. */
export declare function isDiscoveryMatch(hit: PartnerDiscoveryHit | null | undefined): boolean;
/**
 * Full partner-ID scan for discovery jobs. Tries known app hints first, then
 * walks `from`→`to` (default 1000–9999), stopping on the first match.
 */
export declare function scanKalturaOttPartnerIds(request: RequestClient, applicationNameOrUrl: string, options?: ScanKalturaOttPartnerIdsOptions): Promise<ScanKalturaOttPartnerIdsResult>;
/** Exported for unit tests — normalize Android package FQDNs. */
export declare function scrapePartnerCandidates(_text: string): number[];
//# sourceMappingURL=discover.d.ts.map