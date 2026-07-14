import { type Readable } from "stream";
import type { Format, YoutubeDLParams } from "../core/types";
export interface DownloadOptions {
    range?: {
        start?: number;
        end?: number;
    };
    highWaterMark?: number;
    dlChunkSize?: number;
    begin?: string | number | Date;
    liveBuffer?: number;
}
export declare function downloadFormat(format: Format, params?: YoutubeDLParams, options?: DownloadOptions): Readable;
//# sourceMappingURL=http.d.ts.map