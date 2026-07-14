import type { Format } from "./types";
export type FormatFilter = (format: Format) => boolean;
export declare function filterFormats(formats: Format[], filter?: string | FormatFilter): Format[];
export declare function sortFormats(formats: Format[]): Format[];
/**
 * Minimal yt-dlp-like format selector.
 * Supports: best, worst, bestvideo, bestaudio, worstvideo, worstaudio,
 * and simple merges bestvideo+bestaudio (returns both formats).
 */
export declare function selectFormats(formats: Format[], selector?: string): {
    formats: Format[];
    merged: boolean;
};
/** Compat helper matching classic ytdl-core chooseFormat quality strings */
export declare function chooseFormat(formats: Format[], options?: {
    quality?: string | number | string[] | number[];
    filter?: string | FormatFilter;
    format?: Format;
}): Format;
//# sourceMappingURL=format-select.d.ts.map