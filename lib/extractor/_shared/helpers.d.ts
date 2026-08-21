import type { Format, InfoDict } from "../../core/types";
export declare function matchId(url: string, re: RegExp, group?: string | number): string;
export declare function hlsFormat(url: string, formatId?: string): Format;
export type HlsMasterVariant = {
    height: number;
    width: number;
    bandwidth: number;
    name: string;
    playlistUrl: string;
};
/** Parse `#EXT-X-STREAM-INF` variants from an HLS master playlist body. */
export declare function parseHlsMasterPlaylist(masterUrl: string, body: string): HlsMasterVariant[];
/**
 * Expand master `m3u8` formats into per-variant HLS entries (with height / qualityLabel).
 * Leaves progressive formats untouched. Falls back to the original master when fetch fails.
 */
export declare function expandHlsMasterFormats(formats: Format[], fetchText: (url: string) => Promise<string>): Promise<Format[]>;
export declare function dashFormat(url: string, formatId?: string): Format;
export declare function progressiveFormat(url: string, opts?: Partial<Format> & {
    format_id?: string;
}): Format;
export declare function baseInfo(extractor: string, url: string, fields: Omit<InfoDict, "extractor" | "extractor_key" | "webpage_url" | "original_url"> & {
    id: string;
}): InfoDict;
export declare function extractBetween(html: string, left: string, right: string): string | null;
export declare function tryParseJson<T = unknown>(text: string): T | null;
/** Find first balanced `{...}` JSON object starting at `from` index of `{`. */
export declare function extractJsonObject(html: string, from: number): unknown | null;
export declare function searchJsonAssignment(html: string, assignRe: RegExp): unknown | null;
//# sourceMappingURL=helpers.d.ts.map