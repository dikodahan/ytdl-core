"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitchuteIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:(?:www|old)\.)?bitchute\.com\/(?:video|embed|torrent\/[^/?#]+)\/(?<id>[^/?#&]+)/i;
class BitchuteIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "bitchute";
    static IE_DESC = "BitChute";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — media_url progressive / HLS`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async callApi(endpoint, videoId) {
        return this.request.json(`https://api.bitchute.com/api/beta/${endpoint}`, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ video_id: videoId }),
        });
    }
    async extract(url) {
        const id = (0, helpers_1.matchId)(url, VALID_URL);
        const media = await this.callApi("video/media", id);
        const mediaUrl = media.media_url;
        if (!mediaUrl)
            throw new Error(`No BitChute media_url for ${id}`);
        const formats = /\.m3u8/i.test(mediaUrl)
            ? [(0, helpers_1.hlsFormat)(mediaUrl, "hls")]
            : [(0, helpers_1.progressiveFormat)(mediaUrl, { format_id: "http" })];
        let meta = null;
        try {
            meta = await this.callApi("video", id);
        }
        catch {
            /* optional */
        }
        let duration = null;
        if (typeof meta?.duration === "number")
            duration = meta.duration;
        else if (typeof meta?.duration === "string") {
            const parts = meta.duration.split(":").map(Number);
            if (parts.every(n => Number.isFinite(n))) {
                duration = parts.reduce((acc, n) => acc * 60 + n, 0);
            }
        }
        return (0, helpers_1.baseInfo)("bitchute", url, {
            id,
            title: meta?.video_name || id,
            description: meta?.description || null,
            uploader: meta?.profile?.profile_name || meta?.channel?.channel_name || null,
            uploader_id: meta?.profile?.profile_id || meta?.channel?.channel_id || null,
            thumbnail: meta?.thumbnail_url,
            duration,
            formats,
        });
    }
}
exports.BitchuteIE = BitchuteIE;
//# sourceMappingURL=bitchute.js.map