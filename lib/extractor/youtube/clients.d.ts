/** Synced from yt-dlp yt_dlp/extractor/youtube/_base.py (2026.07.04) */
export type StreamingProtocol = "https" | "dash" | "hls";
export interface GvsPoTokenPolicy {
    required?: boolean;
    recommended?: boolean;
    not_required_for_premium?: boolean;
    not_required_with_player_token?: boolean;
}
export interface InnertubeClient {
    INNERTUBE_CONTEXT: {
        client: Record<string, unknown>;
        thirdParty?: Record<string, unknown>;
    };
    INNERTUBE_CONTEXT_CLIENT_NAME: number;
    INNERTUBE_HOST?: string;
    REQUIRE_JS_PLAYER?: boolean;
    REQUIRE_AUTH?: boolean;
    SUPPORTS_COOKIES?: boolean;
    SUPPORTS_AD_PLAYBACK_CONTEXT?: boolean;
    PLAYER_PARAMS?: string | null;
    GVS_PO_TOKEN_POLICY?: Partial<Record<StreamingProtocol, GvsPoTokenPolicy>>;
    PLAYER_PO_TOKEN_POLICY?: {
        required?: boolean;
        recommended?: boolean;
    };
    SUBS_PO_TOKEN_POLICY?: {
        required?: boolean;
        recommended?: boolean;
    };
    priority?: number;
}
export declare const INNERTUBE_CLIENTS: Record<string, InnertubeClient>;
/** Clients that tend to return progressive muxed URLs VLC can open directly */
export declare const DEFAULT_CLIENTS: readonly ["mweb", "android"];
export declare const DEFAULT_JSLESS_CLIENTS: readonly ["android"];
export declare const DEFAULT_AUTHED_CLIENTS: readonly ["tv_downgraded", "mweb"];
export declare const DEFAULT_PREMIUM_CLIENTS: readonly ["tv_downgraded", "web_creator"];
export declare const VLC_CLIENTS: readonly ["mweb", "android"];
export declare function getClientConfig(client: string): InnertubeClient;
//# sourceMappingURL=clients.d.ts.map