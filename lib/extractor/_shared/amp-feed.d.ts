import type { Format } from "../../core/types";
export interface AmpFeedInfo {
    id: string;
    title: string;
    description: string | null;
    thumbnail: string | null;
    duration: number | null;
    timestamp: number | null;
    formats: Format[];
}
/** Parse Akamai Adaptive Media Player JSONP feed (yt-dlp AMPIE). */
export declare function parseAmpFeed(raw: string, videoId: string): AmpFeedInfo;
//# sourceMappingURL=amp-feed.d.ts.map