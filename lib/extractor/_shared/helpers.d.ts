import type { Format, InfoDict } from "../../core/types";
export declare function matchId(url: string, re: RegExp, group?: string | number): string;
export declare function hlsFormat(url: string, formatId?: string): Format;
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