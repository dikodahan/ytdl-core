import type { VideoListEntry } from "../../core/video-list";
/** Resolve a possibly relative href against a page URL. */
export declare function absPageUrl(href: string, pageUrl: string): string;
/** Strip HTML tags and collapse whitespace. */
export declare function stripHtmlText(raw: string): string;
/** Dedupe list entries by id while preserving order. */
export declare function dedupeEntries(entries: VideoListEntry[]): VideoListEntry[];
export declare function parseYouPornWatchEntries(html: string, pageUrl: string): VideoListEntry[];
export declare function parseYouPornNextPage(html: string, pageUrl: string): string | null;
export interface CategoryListEntry {
    id: string;
    url: string;
    title?: string | null;
    display_id?: string | null;
    /** Category/tag preview image when available. */
    thumbnail?: string | null;
}
/** Parse browse categories/tags from the YouPorn homepage or legacy index HTML. */
export declare function parseYouPornCategories(html: string, pageUrl: string): CategoryListEntry[];
export declare function parseYouJizzEntries(html: string, pageUrl: string): VideoListEntry[];
export declare function parseYouJizzNextPage(html: string, pageUrl: string): string | null;
export declare function parseXnxxEntries(html: string, pageUrl: string): VideoListEntry[];
export declare function parseXnxxNextPage(html: string, pageUrl: string): string | null;
/** Parse browse categories/tags from XNXX homepage config or tag index pages. */
export declare function parseXnxxCategories(html: string, pageUrl: string): CategoryListEntry[];
//# sourceMappingURL=page-links.d.ts.map