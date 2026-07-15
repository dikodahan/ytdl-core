import { type Readable } from "stream";
import type { InfoDict, YoutubeDLParams } from "./types";
import type { ListVideosOptions, VideoListResult } from "./video-list";
import type { ExtractorInfo } from "./info-extractor";
import { RequestClient } from "../networking/request";
import { type DownloadOptions } from "../downloader/http";
export declare class YoutubeDL {
    readonly params: YoutubeDLParams;
    readonly request: RequestClient;
    constructor(params?: YoutubeDLParams);
    get extractors(): import("./info-extractor").InfoExtractorConstructor[];
    static listSites(): ExtractorInfo[];
    static capabilities(): {
        impersonateAvailable: boolean;
        impersonateProfiles: readonly ["chrome", "firefox", "safari", "edge"];
        cloudflareBypass: boolean;
    };
    extractInfo(url: string, _download?: boolean): Promise<InfoDict>;
    listVideos(url: string, options?: ListVideosOptions): Promise<VideoListResult>;
    download(url: string, options?: DownloadOptions): Readable;
    close(): Promise<void>;
}
export declare function extractInfo(url: string, params?: YoutubeDLParams): Promise<InfoDict>;
export declare function listVideos(url: string, params?: YoutubeDLParams & ListVideosOptions): Promise<VideoListResult>;
//# sourceMappingURL=youtube-dl.d.ts.map