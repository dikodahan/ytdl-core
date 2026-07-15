import type { YoutubeDLParams } from "../core/types";
import type { ListVideosOptions } from "../core/video-list";
export type ListRequest = YoutubeDLParams & ListVideosOptions & {
    url?: string;
    site?: string;
    service?: string;
};
export declare function parseListBody(raw: string): ListRequest;
export declare function runList(parsed: ListRequest): Promise<{
    status: 400;
    body: {
        error: string;
        hint?: undefined;
        ok?: undefined;
        elapsedMs?: undefined;
        extractor?: undefined;
        webpage_url?: undefined;
        playlist_id?: undefined;
        playlist_title?: undefined;
        page?: undefined;
        count?: undefined;
        next_page_url?: undefined;
        entries?: undefined;
    };
} | {
    status: 400;
    body: {
        error: string;
        hint: string;
        ok?: undefined;
        elapsedMs?: undefined;
        extractor?: undefined;
        webpage_url?: undefined;
        playlist_id?: undefined;
        playlist_title?: undefined;
        page?: undefined;
        count?: undefined;
        next_page_url?: undefined;
        entries?: undefined;
    };
} | {
    status: 200;
    body: {
        ok: boolean;
        elapsedMs: number;
        extractor: string;
        webpage_url: string;
        playlist_id: string | undefined;
        playlist_title: string | undefined;
        page: number | undefined;
        count: number;
        next_page_url: string | null;
        entries: import("../core/video-list").VideoListEntry[];
        error?: undefined;
        hint?: undefined;
    };
}>;
export declare function listMetaForDocs(): {
    method: string;
    path: string;
    auth: boolean;
};
//# sourceMappingURL=list.d.ts.map