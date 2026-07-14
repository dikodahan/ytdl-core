import type { RequestClient } from "../../networking/request";
export declare const YT_BASE = "https://www.youtube.com";
export declare const idRegex: RegExp;
export declare function validateID(id: string): boolean;
export declare function getURLVideoID(link: string): string;
export declare function getVideoID(str: string): string;
export declare function validateURL(string: string): boolean;
export declare function between(haystack: string, left: string | RegExp, right: string): string;
export declare function parseYtInitialPlayerResponse(body: string): Record<string, unknown> | null;
export declare function extractYtcfg(body: string): Record<string, unknown> | null;
export declare function extractPlayerJsUrl(body: string): string | null;
export declare function extractSignatureTimestamp(playerJs: string): string | null;
export declare function extractVisitorData(...sources: Array<Record<string, unknown> | null | undefined>): string | null;
export declare function playabilityError(playerResponse: Record<string, unknown> | null | undefined): Error | null;
export declare function callPlayerApi(request: RequestClient, videoId: string, client: string, opts?: {
    visitorData?: string | null;
    signatureTimestamp?: string | null;
    poToken?: string | null;
    playbackContext?: Record<string, unknown>;
}): Promise<Record<string, unknown>>;
export declare function generateClientPlaybackNonce(length?: number): string;
//# sourceMappingURL=base.d.ts.map