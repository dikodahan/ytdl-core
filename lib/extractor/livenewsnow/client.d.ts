import type { RequestClient } from "../../networking/request";
export declare const LNN_ORIGIN = "https://www.livenewsnow.com";
export declare const LNN_HOME_URL = "https://www.livenewsnow.com/";
export declare const LNN_CATEGORIES: readonly ["american", "business"];
export type LnnCategoryId = (typeof LNN_CATEGORIES)[number];
/** Channel pages live under these path prefixes. */
export declare const LNN_CHANNEL_SECTIONS: readonly ["american", "business", "featured"];
export type LnnChannelSection = (typeof LNN_CHANNEL_SECTIONS)[number];
export declare const LNN_REQUEST_HEADERS: Record<string, string>;
export declare const LNN_STREAM_HEADERS: Record<string, string>;
/** Headers for `?renew=1` token mint (JSON). */
export declare const LNN_RENEW_HEADERS: Record<string, string>;
export interface LnnCategory {
    id: LnnCategoryId;
    title: string;
    url: string;
}
export interface LnnChannel {
    /** Path slug, e.g. `foxnews` or `cnbc`. */
    id: string;
    /** Prefer section/slug when section is not the category default, else slug. */
    displayId: string;
    section: LnnChannelSection;
    title: string;
    pageUrl: string;
    thumbnail: string | null;
    categoryIds: LnnCategoryId[];
}
export interface LnnStreamInfo {
    channelId: string;
    title: string;
    streamUrl: string;
    pageUrl: string;
    thumbnail: string | null;
    section: LnnChannelSection | null;
}
/** Match channel HTML pages: `/american/cnbc.html`, `/featured/foxnews`. */
export declare const CHANNEL_PAGE_URL: RegExp;
/** Category listing pages. */
export declare const CATEGORY_PAGE_URL: RegExp;
/** Signed HLS on livenewsplay(er).com (token/expires/sig or sec-/newz- params). */
export declare const SIGNED_HLS_URL: RegExp;
export declare function lnnCategoryUrl(id: LnnCategoryId): string;
export declare function lnnChannelPageUrl(section: LnnChannelSection, slug: string): string;
export declare function listLnnCategories(): LnnCategory[];
/** Unescape JS/JSON string fragments (`\\u0026`, `\\/`, etc.). */
export declare function unescapeJsString(raw: string): string;
export declare function parseChannelPageUrl(url: string): {
    section: LnnChannelSection;
    slug: string;
    pageUrl: string;
} | null;
export declare function parseCategoryPageUrl(url: string): LnnCategoryId | null;
/** Parse `livenewsnow:foxnews`, `livenewsnow:featured/foxnews`, `livenewsnow:american`. */
export declare function parseLnnPseudoId(raw: string): {
    kind: "categories" | "category" | "channel";
    categoryId?: LnnCategoryId;
    section?: LnnChannelSection;
    slug?: string;
} | null;
/** Extract a playable signed HLS URL from a channel page body. */
export declare function extractSignedStreamUrl(html: string): string | null;
export declare function parseChannelMeta(html: string, fallbackTitle: string): {
    title: string;
    thumbnail: string | null;
    channelKey: string | null;
};
/** Parse channel cards from a category archive page. */
export declare function parseCategoryChannelsHtml(html: string, categoryId: LnnCategoryId, pageUrl?: string): LnnChannel[];
/** Collect `/category/{id}/page/N` links from archive HTML (WordPress pagination). */
export declare function categoryArchivePageUrls(html: string, categoryId: LnnCategoryId): string[];
export declare function discoverLnnCategoryChannels(request: RequestClient, categoryId: LnnCategoryId): Promise<LnnChannel[]>;
export declare function discoverAllLnnChannels(request: RequestClient): Promise<LnnChannel[]>;
export declare function resolveLnnChannel(request: RequestClient, ref: {
    section?: LnnChannelSection;
    slug: string;
}): Promise<LnnChannel>;
/** Build the on-page renew URL used by the Live News Now player (`?renew=1`). */
export declare function lnnRenewUrl(pageUrl: string): string;
/** Parse `{"url":"…","expires_in":3600}` (or the same JSON embedded in HTML). */
export declare function parseLnnRenewResponse(body: string): {
    url: string;
    expiresIn: number;
} | null;
/**
 * Mint a fresh signed HLS URL via the channel page's `?renew=1` endpoint.
 * Returns null when the page does not support renew (legacy JWPlayer embeds).
 */
export declare function renewLnnStreamUrl(request: RequestClient, pageUrl: string): Promise<string | null>;
export declare function extractLnnStreamFromPage(request: RequestClient, pageUrl: string): Promise<LnnStreamInfo>;
//# sourceMappingURL=client.d.ts.map