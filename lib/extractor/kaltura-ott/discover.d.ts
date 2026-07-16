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
export interface DiscoverKalturaOttOptions {
    /**
     * Probe partner IDs sequentially when app hints find nothing (default true
     * for unknown Android package names).
     */
    deepScan?: boolean;
    /** Max login probes during deep scan (default 120). */
    deepScanLimit?: number;
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
/** Exported for unit tests — normalize Android package FQDNs. */
export declare function scrapePartnerCandidates(_text: string): number[];
//# sourceMappingURL=discover.d.ts.map