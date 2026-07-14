import type { InfoDict } from "../../core/types";
import type { RequestClient } from "../../networking/request";
/** Best-effort scrape of playable media URLs from an HTML page (OG / JSON-LD / <video>). */
export declare function extractWebpageMedia(request: RequestClient, pageUrl: string, extractorName: string): Promise<InfoDict>;
//# sourceMappingURL=webpage-media.d.ts.map