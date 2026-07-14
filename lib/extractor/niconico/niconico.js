"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NiconicoIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:(?:embed|sp|www)\.)?nicovideo\.jp\/(?:shorts|watch)\/(?<id>(?:[a-z]{2})?\d+)/i;
const API_BASE = "https://nvapi.nicovideo.jp";
const BASE_URL = "https://www.nicovideo.jp";
const HEADERS = {
    "X-Frontend-ID": "6",
    "X-Frontend-Version": "0",
};
const ERROR_MAP = {
    FORBIDDEN: {
        ADMINISTRATOR_DELETE_VIDEO: "Video unavailable, possibly removed by admins",
        CHANNEL_MEMBER_ONLY: "Channel members only",
        DELETED_CHANNEL_VIDEO: "Video unavailable, channel was closed",
        DELETED_COMMUNITY_VIDEO: "Video unavailable, community deleted or missing",
        DEFAULT: "Page unavailable, check the URL",
        HARMFUL_VIDEO: "Sensitive content, login required",
        HIDDEN_VIDEO: "Video unavailable, set to private",
        NOT_ALLOWED: "No permission",
        PPV_VIDEO: "PPV video, payment information required",
        PREMIUM_ONLY: "Premium members only",
    },
    INVALID_PARAMETER: {
        DEFAULT: "Video unavailable, may not exist or was deleted",
    },
    MAINTENANCE: { DEFAULT: "Maintenance is in progress" },
    NOT_FOUND: {
        DEFAULT: "Video unavailable, may not exist or was deleted",
        RIGHT_HOLDER_DELETE_VIDEO: "Removed by rights-holder request",
    },
    UNAUTHORIZED: { DEFAULT: "Invalid session, re-login required" },
    UNKNOWN: { DEFAULT: "Failed to fetch content" },
};
class NiconicoIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "niconico";
    static IE_DESC = "ニコニコ動画 / niconico";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — guest API + HLS access-rights`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const videoId = (0, helpers_1.matchId)(url, VALID_URL);
        const trackId = `AAAAAAAAAA_${Date.now()}`;
        const apiResp = await this.request.json(`${BASE_URL}/api/watch/v3_guest/${videoId}`, {
            headers: { ...HEADERS },
            query: { actionTrackId: trackId },
        }).catch(async (err) => {
            if (err.statusCode && err.body) {
                try {
                    return JSON.parse(err.body);
                }
                catch {
                    /* fall through */
                }
            }
            throw err;
        });
        const status = apiResp.meta?.status ?? 0;
        const apiData = apiResp.data;
        if (status !== 200 || !apiData) {
            const errCode = (apiResp.meta?.errorCode || "UNKNOWN").toUpperCase();
            const reason = apiData?.reasonCode || "DEFAULT";
            let errMsg = ERROR_MAP[errCode]?.[reason] || ERROR_MAP[errCode]?.DEFAULT || `API returned error status ${status}`;
            if (reason === "DOMESTIC_VIDEO" || reason === "HIGH_RISK_COUNTRY_VIDEO") {
                throw new Error("niconico: geo-restricted to Japan");
            }
            if (reason === "HARMFUL_VIDEO" &&
                apiData?.viewer?.allowSensitiveContents === false) {
                errMsg = "Sensitive content, adjust display settings to watch";
            }
            if (reason === "HIDDEN_VIDEO" && apiData?.publishScheduledAt) {
                errMsg = `This content is scheduled to be released at ${apiData.publishScheduledAt}`;
            }
            if (["CHANNEL_MEMBER_ONLY", "HARMFUL_VIDEO", "HIDDEN_VIDEO", "PPV_VIDEO", "PREMIUM_ONLY"].includes(reason)) {
                throw new Error(`niconico: login required — ${errMsg}`);
            }
            throw new Error(`niconico: ${errMsg}`);
        }
        const formats = await this.extractFormats(apiData, videoId);
        if (!formats.length) {
            const pay = apiData.payment?.video;
            if (pay?.isPremium)
                throw new Error("niconico: Premium members only (login required)");
            if (pay?.isAdmission)
                throw new Error("niconico: Channel members only (login required)");
            if (pay?.isPpv || pay?.isContinuationBenefit) {
                throw new Error("niconico: PPV video, payment information required");
            }
            throw new Error(`niconico: no playable HLS formats for ${videoId}`);
        }
        const owner = apiData.channel || apiData.owner;
        const thumbs = apiData.video?.thumbnail || {};
        const thumbnail = thumbs.player || thumbs.ogp || thumbs.largeUrl || thumbs.middleUrl || thumbs.url;
        return (0, helpers_1.baseInfo)("niconico", url, {
            id: apiData.video?.id || videoId,
            title: apiData.video?.title || videoId,
            description: apiData.video?.description || null,
            duration: apiData.video?.duration ?? null,
            uploader: owner?.name || owner?.nickname || null,
            uploader_id: owner?.id != null ? String(owner.id) : null,
            thumbnail,
            formats,
            http_headers: { Referer: `${BASE_URL}/` },
        });
    }
    async extractFormats(apiData, videoId) {
        const videos = (apiData.media?.domand?.videos || []).filter(v => v.isAvailable && v.id);
        const audios = (apiData.media?.domand?.audios || []).filter(a => a.isAvailable && a.id);
        const accessKey = apiData.media?.domand?.accessRightKey;
        const trackId = apiData.client?.watchTrackId;
        if (!videos.length || !audios.length || !accessKey || !trackId)
            return [];
        const outputs = [];
        for (const v of videos) {
            for (const a of audios) {
                if (v.id && a.id)
                    outputs.push([v.id, a.id]);
            }
        }
        const hlsResp = await this.request.json(`${API_BASE}/v1/watch/${videoId}/access-rights/hls`, {
            method: "POST",
            query: { actionTrackId: trackId },
            headers: {
                Accept: "application/json;charset=utf-8",
                "Content-Type": "application/json",
                "X-Access-Right-Key": accessKey,
                "X-Request-With": BASE_URL,
                ...HEADERS,
            },
            body: JSON.stringify({ outputs }),
        });
        const contentUrl = hlsResp.data?.contentUrl;
        if (!contentUrl)
            return [];
        // Best-effort: one master HLS covering the video×audio quality product
        return [(0, helpers_1.hlsFormat)(contentUrl, "hls")];
    }
}
exports.NiconicoIE = NiconicoIE;
//# sourceMappingURL=niconico.js.map