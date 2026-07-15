import type { ExtractorInfo } from "../core/info-extractor";
/**
 * User-facing URL expectations per service.
 *
 * yt-dlp does not ship a dedicated “what link to paste” guide — only IE_DESC,
 * `_VALID_URL`, and `_TESTS` example URLs. These guides are derived from those
 * plus the VLC-oriented ports in this package.
 */
export interface UrlUsageGuide {
    /** Short instruction: what the user should paste */
    usage: string;
    /** Example URLs (valid share / embed / id forms) */
    examples: string[];
    /** Optional caveats (geo, cookies, pseudo-URLs) */
    notes?: string;
}
export declare const URL_USAGE: Record<string, UrlUsageGuide>;
/** Listing-page guides for `POST /api/v1/list` (video id enumeration). */
export declare const LIST_URL_USAGE: Record<string, UrlUsageGuide>;
/** Attach urlUsage / examples / notes onto extractor meta. */
export declare function withUrlUsage(info: ExtractorInfo): ExtractorInfo;
//# sourceMappingURL=url-usage.d.ts.map