import type { VideoListEntry } from "../../core/video-list";
/** Resolve a possibly relative href against a page URL. */
export declare function absPageUrl(href: string, pageUrl: string): string;
/** Strip HTML tags and collapse whitespace. */
export declare function stripHtmlText(raw: string): string;
/** Dedupe list entries by id while preserving order. */
export declare function dedupeEntries(entries: VideoListEntry[]): VideoListEntry[];
export declare function parseYouPornWatchEntries(html: string, pageUrl: string): VideoListEntry[];
export declare function parseYouPornNextPage(html: string, pageUrl: string): string | null;
export declare function parseYouJizzEntries(html: string, pageUrl: string): VideoListEntry[];
export declare function parseYouJizzNextPage(html: string, pageUrl: string): string | null;
//# sourceMappingURL=page-links.d.ts.map