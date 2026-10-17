import type { RequestClient } from "../../networking/request";
import type { KalturaOttPartnerPreset } from "./presets";
export interface KalturaOttSession {
    ks: string;
    sessionId: string | null;
    expiry: number | null;
    /** UDID this session was logged in with. */
    udid?: string;
    /** Household device name, when the session was re-logged in as a registered device. */
    deviceName?: string | null;
}
export interface KalturaOttHouseholdDevice {
    udid?: string;
    name?: string;
    brandId?: number;
    deviceFamilyId?: number;
    status?: string;
    state?: string;
}
export interface KalturaOttCredentials {
    username: string;
    password: string;
    /** Optional: force login with this registered household device UDID. */
    deviceUdid?: string;
}
export declare class KalturaOttAuthenticationError extends Error {
    readonly code = "KALTURA_OTT_AUTHENTICATION_FAILED";
    readonly statusCode = 401;
    constructor(message?: string);
}
export declare class KalturaOttSubscriptionRequiredError extends Error {
    readonly code = "KALTURA_OTT_SUBSCRIPTION_REQUIRED";
    readonly statusCode = 403;
    constructor(authenticated: boolean);
}
export interface KalturaOttImage {
    url?: string;
    imageTypeName?: string;
    ratio?: string;
}
export interface KalturaOttMediaFile {
    type?: string;
    url?: string;
    id?: number;
}
export interface KalturaOttLiveAsset {
    id?: number;
    name?: string;
    description?: string;
    externalIds?: string;
    externalId?: string;
    externalEpgIngestId?: string;
    images?: KalturaOttImage[];
    mediaFiles?: KalturaOttMediaFile[];
    metas?: Record<string, {
        value?: number | string | boolean;
    }>;
    objectType?: string;
}
export interface KalturaOttProgramAsset {
    id?: number;
    name?: string;
    description?: string;
    externalId?: string;
    epgChannelId?: number | string;
    linearAssetId?: number;
    startDate?: number;
    endDate?: number;
    images?: KalturaOttImage[];
    objectType?: string;
}
interface KalturaPlaybackSource {
    type?: string;
    url?: string;
    format?: string;
}
export declare class KalturaOttClient {
    private readonly request;
    private readonly preset;
    private readonly credentials?;
    private session;
    constructor(request: RequestClient, preset: KalturaOttPartnerPreset, credentials?: KalturaOttCredentials | undefined);
    ensureSession(): Promise<KalturaOttSession>;
    /** Drop the cached session (e.g. after a KS-expired response). */
    invalidateSession(): void;
    private listHouseholdDevices;
    private loginWithUdid;
    private serveByDevice;
    private apiBase;
    private postApi;
    listChannels(lineupId: number, pageSize?: number): Promise<KalturaOttLiveAsset[]>;
    /**
     * Android TV / living-room catalog: enumerate `KalturaLiveAsset` rows by
     * ChannelNumber meta. Cellcom's mobile lineup omits CharletonPremium sports
     * (ספורט 1–4 / 6) that only publish HLS_BIGSCREEN media files.
     */
    listLiveChannelsByLcn(options?: {
        maxLcn?: number;
        step?: number;
    }): Promise<KalturaOttLiveAsset[]>;
    getLiveAsset(assetId: number): Promise<KalturaOttLiveAsset>;
    getAssetById(assetId: number): Promise<KalturaOttLiveAsset>;
    fetchEpgPrograms(channelRef: string, days: number, channelAssets?: KalturaOttLiveAsset[]): Promise<KalturaOttProgramAsset[]>;
    private fetchEpgCache;
    private fetchEpgSearch;
    getProgramPlayback(programId: number, context?: "CATCHUP" | "START_OVER" | "PLAYBACK"): Promise<KalturaPlaybackSource[]>;
    getLivePlayback(assetId: number): Promise<KalturaPlaybackSource[]>;
    private getLivePlaybackOnce;
    /**
     * Turn a Kaltura `playManifest` source URL into the fully playable stream
     * link. The playManifest URL wraps the signed livetv play request
     * (`tokenizedUrl/<base64>/ks/<KS>/a.m3u8`); following its redirects
     * (playManifest → livetv → signed CDN) yields the playable URL. When the
     * livetv/CDN hop cannot be reached from this network, fall back to the
     * decoded signed play-request URL, which a player can resolve itself.
     */
    resolveStreamLink(sourceUrl: string): Promise<ResolvedStreamLink>;
    getProgramAsset(programId: number): Promise<KalturaOttProgramAsset>;
}
export interface KalturaPlayRequestParams {
    token: string | null;
    expires: number | null;
    extStartLimit: number | null;
    smilProfile: string | null;
}
export interface ResolvedStreamLink {
    /** Fully playable stream URL (signed CDN URL when resolution succeeded). */
    playableUrl: string;
    /** Signed livetv play-request URL decoded from the playManifest wrapper. */
    playRequestUrl: string | null;
    /** Per-channel play-request token (the livetv `token=` value). */
    playRequestToken: string | null;
    /** Play-request expiry (unix seconds) from the livetv URL. */
    playRequestExpires: number | null;
    /** True when playableUrl is the final redirected CDN playlist. */
    resolved: boolean;
}
/**
 * Decode the signed livetv play-request URL wrapped in a Kaltura
 * playManifest URL: `.../tokenizedUrl/<base64>/ks/<KS>/a.m3u8`.
 * The base64 segment may itself contain `/`, so capture up to `/ks/`.
 */
export declare function decodePlayRequestUrl(playManifestUrl: string): string | null;
/** Extract the token and its parameters from a livetv play-request URL. */
export declare function parsePlayRequestParams(playRequestUrl: string | null): KalturaPlayRequestParams;
export declare function pickChannelLogo(images: KalturaOttImage[] | undefined): string | null;
export declare function pickStreamFormats(files: KalturaOttMediaFile[] | undefined): {
    hls: string | null;
    dash: string | null;
};
/** Collect unique playable mediaFile URLs (HLS / DASH), HTTPS first. */
export declare function collectMediaFileStreamUrls(files: KalturaOttMediaFile[] | undefined, opts?: {
    preferBigscreen?: boolean;
}): Array<{
    url: string;
    type: string;
}>;
export {};
//# sourceMappingURL=client.d.ts.map