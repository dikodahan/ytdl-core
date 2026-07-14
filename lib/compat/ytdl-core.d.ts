import { type Readable } from "stream";
import type { Format, YoutubeDLParams } from "../core/types";
type Filter = "audioandvideo" | "videoandaudio" | "video" | "videoonly" | "audio" | "audioonly" | ((format: CompatFormat) => boolean);
interface CompatFormat extends Format {
    hasAudio?: boolean;
    hasVideo?: boolean;
    container?: string;
    codecs?: string;
    videoCodec?: string;
    audioCodec?: string;
    isLive?: boolean;
}
interface VideoDetails {
    videoId: string;
    title: string;
    lengthSeconds: string;
    keywords?: string[];
    channelId?: string;
    isOwnerViewing?: boolean;
    shortDescription?: string;
    isCrawlable?: boolean;
    thumbnail?: {
        thumbnails: Array<{
            url: string;
            width?: number;
            height?: number;
        }>;
    };
    averageRating?: number;
    allowRatings?: boolean;
    viewCount?: string;
    author?: string;
    isPrivate?: boolean;
    isUnpluggedCorpus?: boolean;
    isLiveContent?: boolean;
    isLive?: boolean;
    likes?: number | null;
    age_restricted?: boolean;
    video_url?: string;
    [key: string]: unknown;
}
interface VideoInfo {
    full: boolean;
    page: string[];
    player_response: Record<string, unknown>;
    response?: Record<string, unknown>;
    html5player?: string | null;
    formats: CompatFormat[];
    related_videos?: unknown[];
    videoDetails: VideoDetails;
    video_url?: string;
    videoUrl?: string;
    bestFormat?: CompatFormat;
    selectedFormat?: CompatFormat;
    [key: string]: unknown;
}
interface getInfoOptions {
    lang?: string;
    agent?: YoutubeDLParams["agent"];
    playerClients?: Array<"WEB_EMBEDDED" | "TV" | "IOS" | "ANDROID" | "WEB" | string>;
    requestOptions?: Record<string, unknown>;
    poTokens?: YoutubeDLParams["poTokens"];
    headers?: Record<string, string>;
}
interface chooseFormatOptions {
    quality?: "lowest" | "highest" | "highestaudio" | "lowestaudio" | "highestvideo" | "lowestvideo" | string | number | string[] | number[];
    filter?: Filter;
    format?: CompatFormat;
}
interface downloadOptions extends getInfoOptions, chooseFormatOptions {
    range?: {
        start?: number;
        end?: number;
    };
    begin?: string | number | Date;
    liveBuffer?: number;
    highWaterMark?: number;
    IPv6Block?: string;
    dlChunkSize?: number;
}
declare function ytdl(link: string, options?: downloadOptions): Readable;
declare namespace ytdl {
    var getBasicInfo: (link: string, options?: getInfoOptions) => Promise<VideoInfo>;
    var getInfo: (link: string, options?: getInfoOptions) => Promise<VideoInfo>;
    var downloadFromInfo: (info: VideoInfo, options?: downloadOptions) => Readable;
    var chooseFormat: (formats: CompatFormat | CompatFormat[], options?: chooseFormatOptions) => CompatFormat;
    var filterFormats: (formats: CompatFormat[], filter?: Filter) => CompatFormat[];
    var validateID: typeof import("../extractor/youtube/base").validateID;
    var validateURL: typeof import("../extractor/youtube/base").validateURL;
    var getURLVideoID: typeof import("../extractor/youtube/base").getURLVideoID;
    var getVideoID: typeof import("../extractor/youtube/base").getVideoID;
    var createAgent: typeof import("../networking/request").createAgent;
    var createProxyAgent: typeof import("../networking/request").createProxyAgent;
    var cache: {
        info: Map<string, {
            value: Promise<VideoInfo>;
            expires: number;
        }>;
        watch: Map<string, {
            value: Promise<string>;
            expires: number;
        }>;
    };
    var version: string;
}
export = ytdl;
//# sourceMappingURL=ytdl-core.d.ts.map