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
    /** Probe partner IDs sequentially when scrape finds nothing (default false). */
    deepScan?: boolean;
    /** Max login probes during deep scan (default 120). */
    deepScanLimit?: number;
    /** Max linked script files to fetch (default 6). */
    maxScripts?: number;
    /** Max scraped candidates to login-probe (default 20). */
    maxCandidates?: number;
    /** Page/script fetch timeout in ms (default 15000). */
    fetchTimeoutMs?: number;
}
export interface DiscoverKalturaOttResult {
    ok: boolean;
    inputUrl: string;
    domain: string;
    hits: PartnerDiscoveryHit[];
    candidates: number[];
    scannedScripts: number;
    probesAttempted: number;
    elapsedMs: number;
    notes: string[];
}
export declare function discoverKalturaOttPartner(request: RequestClient, inputUrl: string, options?: DiscoverKalturaOttOptions): Promise<DiscoverKalturaOttResult>;
/** Exported for unit tests — parse partner ids from arbitrary text. */
export declare function scrapePartnerCandidates(text: string): number[];
//# sourceMappingURL=discover.d.ts.map