import type { RequestClient } from "../../networking/request";
import type { KalturaOttPartnerPreset } from "./presets";
export interface KalturaOttSession {
    ks: string;
    sessionId: string | null;
    expiry: number | null;
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
    private session;
    constructor(request: RequestClient, preset: KalturaOttPartnerPreset);
    ensureSession(): Promise<KalturaOttSession>;
    private serveByDevice;
    private apiBase;
    private postApi;
    listChannels(lineupId: number, pageSize?: number): Promise<KalturaOttLiveAsset[]>;
    getLiveAsset(assetId: number): Promise<KalturaOttLiveAsset>;
    fetchEpgPrograms(channelRef: string, days: number, channelAssets?: KalturaOttLiveAsset[]): Promise<KalturaOttProgramAsset[]>;
    private fetchEpgCache;
    private fetchEpgSearch;
    getProgramPlayback(programId: number, context?: "CATCHUP" | "START_OVER" | "PLAYBACK"): Promise<KalturaPlaybackSource[]>;
    getProgramAsset(programId: number): Promise<KalturaOttProgramAsset>;
}
export declare function pickChannelLogo(images: KalturaOttImage[] | undefined): string | null;
export declare function pickStreamFormats(files: KalturaOttMediaFile[] | undefined): {
    hls: string | null;
    dash: string | null;
};
export {};
//# sourceMappingURL=client.d.ts.map