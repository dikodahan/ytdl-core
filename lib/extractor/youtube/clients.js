"use strict";
/** Synced from yt-dlp yt_dlp/extractor/youtube/_base.py (2026.07.04) */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VLC_CLIENTS = exports.DEFAULT_PREMIUM_CLIENTS = exports.DEFAULT_AUTHED_CLIENTS = exports.DEFAULT_JSLESS_CLIENTS = exports.DEFAULT_CLIENTS = exports.INNERTUBE_CLIENTS = void 0;
exports.getClientConfig = getClientConfig;
const WEB_PO_TOKEN_POLICIES = {
    GVS_PO_TOKEN_POLICY: {
        https: {
            required: true,
            recommended: true,
            not_required_for_premium: true,
            not_required_with_player_token: false,
        },
        dash: {
            required: true,
            recommended: true,
            not_required_for_premium: true,
            not_required_with_player_token: false,
        },
        hls: { required: false, recommended: true },
    },
    PLAYER_PO_TOKEN_POLICY: { required: false },
    SUBS_PO_TOKEN_POLICY: { required: false },
};
exports.INNERTUBE_CLIENTS = {
    web: {
        INNERTUBE_CONTEXT: {
            client: { clientName: "WEB", clientVersion: "2.20260708.00.00" },
        },
        INNERTUBE_CONTEXT_CLIENT_NAME: 1,
        SUPPORTS_COOKIES: true,
        ...WEB_PO_TOKEN_POLICIES,
    },
    web_safari: {
        INNERTUBE_CONTEXT: {
            client: {
                clientName: "WEB",
                clientVersion: "2.20260708.00.00",
                userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Safari/605.1.15,gzip(gfe)",
            },
        },
        INNERTUBE_CONTEXT_CLIENT_NAME: 1,
        SUPPORTS_COOKIES: true,
        ...WEB_PO_TOKEN_POLICIES,
    },
    web_embedded: {
        INNERTUBE_CONTEXT: {
            client: {
                clientName: "WEB_EMBEDDED_PLAYER",
                clientVersion: "2.20260708.00.00",
            },
        },
        INNERTUBE_CONTEXT_CLIENT_NAME: 56,
        SUPPORTS_COOKIES: true,
    },
    web_creator: {
        INNERTUBE_CONTEXT: {
            client: {
                clientName: "WEB_CREATOR",
                clientVersion: "1.20260708.06.00",
            },
        },
        INNERTUBE_CONTEXT_CLIENT_NAME: 62,
        REQUIRE_AUTH: true,
        SUPPORTS_COOKIES: true,
        GVS_PO_TOKEN_POLICY: WEB_PO_TOKEN_POLICIES.GVS_PO_TOKEN_POLICY,
    },
    android: {
        INNERTUBE_CONTEXT: {
            client: {
                clientName: "ANDROID",
                clientVersion: "21.26.364",
                androidSdkVersion: 30,
                userAgent: "com.google.android.youtube/21.26.364 (Linux; U; Android 11) gzip",
                osName: "Android",
                osVersion: "11",
            },
        },
        INNERTUBE_CONTEXT_CLIENT_NAME: 3,
        REQUIRE_JS_PLAYER: false,
        GVS_PO_TOKEN_POLICY: {
            https: { required: true, recommended: true, not_required_with_player_token: true },
            dash: { required: true, recommended: true, not_required_with_player_token: true },
            hls: { required: false, recommended: true, not_required_with_player_token: true },
        },
        PLAYER_PO_TOKEN_POLICY: { required: false, recommended: true },
    },
    android_vr: {
        INNERTUBE_CONTEXT: {
            client: {
                clientName: "ANDROID_VR",
                clientVersion: "1.65.10",
                deviceMake: "Oculus",
                deviceModel: "Quest 3",
                androidSdkVersion: 32,
                userAgent: "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
                osName: "Android",
                osVersion: "12L",
            },
        },
        INNERTUBE_CONTEXT_CLIENT_NAME: 28,
        REQUIRE_JS_PLAYER: false,
    },
    ios: {
        INNERTUBE_CONTEXT: {
            client: {
                clientName: "IOS",
                clientVersion: "21.26.4",
                deviceMake: "Apple",
                deviceModel: "iPhone16,2",
                userAgent: "com.google.ios.youtube/21.26.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)",
                osName: "iPhone",
                osVersion: "18.3.2.22D82",
            },
        },
        INNERTUBE_CONTEXT_CLIENT_NAME: 5,
        REQUIRE_JS_PLAYER: false,
        GVS_PO_TOKEN_POLICY: {
            https: { required: true, recommended: true, not_required_with_player_token: true },
            hls: { required: true, recommended: true, not_required_with_player_token: true },
        },
        PLAYER_PO_TOKEN_POLICY: { required: false, recommended: true },
    },
    mweb: {
        INNERTUBE_CONTEXT: {
            client: {
                clientName: "MWEB",
                clientVersion: "2.20260708.05.00",
                userAgent: "Mozilla/5.0 (iPad; CPU OS 16_7_10 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1,gzip(gfe)",
            },
        },
        INNERTUBE_CONTEXT_CLIENT_NAME: 2,
        SUPPORTS_COOKIES: true,
        ...WEB_PO_TOKEN_POLICIES,
    },
    tv: {
        INNERTUBE_CONTEXT: {
            client: {
                clientName: "TVHTML5",
                clientVersion: "7.20260707.07.00",
                userAgent: "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/25.lts.30.1034943-gold (unlike Gecko), Unknown_TV_Unknown_0/Unknown (Unknown, Unknown)",
            },
        },
        INNERTUBE_CONTEXT_CLIENT_NAME: 7,
        SUPPORTS_COOKIES: true,
    },
    tv_downgraded: {
        INNERTUBE_CONTEXT: {
            client: {
                clientName: "TVHTML5",
                clientVersion: "5.20260707",
                userAgent: "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version",
            },
        },
        INNERTUBE_CONTEXT_CLIENT_NAME: 7,
        REQUIRE_AUTH: true,
        SUPPORTS_COOKIES: true,
    },
};
for (const [, ytcfg] of Object.entries(exports.INNERTUBE_CLIENTS)) {
    ytcfg.INNERTUBE_HOST ??= "www.youtube.com";
    ytcfg.REQUIRE_JS_PLAYER ??= true;
    ytcfg.REQUIRE_AUTH ??= false;
    ytcfg.SUPPORTS_COOKIES ??= false;
    ytcfg.GVS_PO_TOKEN_POLICY ??= {};
    for (const protocol of ["https", "dash", "hls"]) {
        ytcfg.GVS_PO_TOKEN_POLICY[protocol] ??= {};
    }
    ytcfg.PLAYER_PO_TOKEN_POLICY ??= {};
    ytcfg.SUBS_PO_TOKEN_POLICY ??= {};
    ytcfg.INNERTUBE_CONTEXT.client.hl ??= "en";
}
/** Clients that tend to return progressive muxed URLs VLC can open directly */
exports.DEFAULT_CLIENTS = ["mweb", "android"];
exports.DEFAULT_JSLESS_CLIENTS = ["android"];
exports.DEFAULT_AUTHED_CLIENTS = ["tv_downgraded", "mweb"];
exports.DEFAULT_PREMIUM_CLIENTS = ["tv_downgraded", "web_creator"];
exports.VLC_CLIENTS = ["mweb", "android"];
function getClientConfig(client) {
    const cfg = exports.INNERTUBE_CLIENTS[client];
    if (!cfg)
        throw new Error(`Unknown Innertube client: ${client}`);
    return structuredClone(cfg);
}
//# sourceMappingURL=clients.js.map