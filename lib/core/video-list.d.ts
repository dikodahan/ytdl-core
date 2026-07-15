/** Single entry in a site listing (browse / category / channel page). */
export interface VideoListEntry {
    id: string;
    /** Canonical watch/share URL for this id. */
    url: string;
    title?: string | null;
    display_id?: string | null;
}
export interface VideoListResult {
    extractor: string;
    webpage_url: string;
    playlist_id?: string;
    playlist_title?: string;
    page?: number;
    entries: VideoListEntry[];
    /** URL for the next page, if the site exposes pagination on this listing. */
    next_page_url?: string | null;
}
export interface ListVideosOptions {
    /** 1-based page override (mutates listing URL when supported). */
    page?: number;
    /** Max entries to return from the fetched page (default: all on page). */
    limit?: number;
}
//# sourceMappingURL=video-list.d.ts.map