import type { IncomingMessage } from "http";
import type { YoutubeDLParams } from "../core/types";
export declare function isLoopback(req: IncomingMessage): boolean;
export declare function extractBearerToken(req: IncomingMessage): string | null;
export type ExtractRequest = YoutubeDLParams & {
    url?: string;
    site?: string;
    service?: string;
};
export declare function parseExtractBody(raw: string): ExtractRequest;
export declare function metaPayload(): {
    sites: import("..").ExtractorInfo[];
    capabilities: {
        impersonateAvailable: boolean;
        impersonateProfiles: readonly ["chrome", "firefox", "safari", "edge"];
        cloudflareBypass: boolean;
    };
    globalOptions: ({
        key: string;
        label: string;
        type: string;
        description: string;
        default: string;
        choices: {
            value: string;
            label: string;
        }[];
    } | {
        key: string;
        label: string;
        type: string;
        description: string;
        default: boolean;
        choices?: undefined;
    } | {
        key: string;
        label: string;
        type: string;
        description: string;
        default: string;
        choices?: undefined;
    })[];
    api: {
        version: string;
        auth: string;
        endpoints: ({
            method: string;
            path: string;
            auth: boolean;
        } | {
            method: string;
            path: string;
            auth: string;
        })[];
    };
};
export declare function runExtract(parsed: ExtractRequest): Promise<{
    status: 400;
    body: {
        error: string;
        ok?: undefined;
        elapsedMs?: undefined;
        extractor?: undefined;
        id?: undefined;
        title?: undefined;
        duration?: undefined;
        thumbnail?: undefined;
        webpage_url?: undefined;
        formatCount?: undefined;
        formats?: undefined;
        recommended?: undefined;
    };
} | {
    status: 200;
    body: {
        ok: boolean;
        elapsedMs: number;
        extractor: string | undefined;
        id: string;
        title: string | undefined;
        duration: number | null | undefined;
        thumbnail: string | undefined;
        webpage_url: string | undefined;
        formatCount: number;
        formats: {
            format_id: string;
            itag: number | undefined;
            ext: string | undefined;
            protocol: string | undefined;
            resolution: string | null;
            qualityLabel: string | undefined;
            fps: number | null | undefined;
            vcodec: string | null | undefined;
            acodec: string | null | undefined;
            tbr: number | null | undefined;
            filesize: number | null | undefined;
            has_video: boolean | undefined;
            has_audio: boolean | undefined;
            isHLS: boolean | undefined;
            isDashMPD: boolean | undefined;
            client: string | undefined;
            vlc_ready: boolean;
            url: string | null;
            http_headers: {} | null;
        }[];
        recommended: {
            format_id: string;
            itag: number | undefined;
            qualityLabel: string | undefined;
            resolution: string | null | undefined;
            client: string | undefined;
            url: string | null;
            http_headers: {} | null;
        } | null;
        error?: undefined;
    };
}>;
//# sourceMappingURL=extract.d.ts.map