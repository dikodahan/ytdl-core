import type { YoutubeDLParams } from "../core/types";
export interface DiscoverKalturaOttRequest {
    /** Android applicationId / package FQDN (e.g. com.cellcom.cellcomtv). */
    applicationName: string;
    deepScan?: boolean;
    deepScanLimit?: number;
    proxy?: string;
    impersonate?: YoutubeDLParams["impersonate"];
    cloudflareBypass?: boolean;
}
export declare function parseDiscoverKalturaOttBody(raw: string): DiscoverKalturaOttRequest;
export declare function runDiscoverKalturaOtt(parsed: DiscoverKalturaOttRequest): Promise<{
    status: 200;
    body: {
        elapsedMs: number;
        ok: boolean;
        applicationName: string;
        inputUrl: string;
        hits: import("../extractor/kaltura-ott/discover").PartnerDiscoveryHit[];
        candidates: number[];
        probesAttempted: number;
        notes: string[];
        error?: undefined;
    };
} | {
    status: 500;
    body: {
        ok: boolean;
        error: string;
        elapsedMs: number;
    };
}>;
//# sourceMappingURL=discover.d.ts.map