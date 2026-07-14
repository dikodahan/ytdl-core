"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailymotionIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^(?:https?:)?\/\/(?:dai\.ly\/|(?:(?:www|touch|geo)\.)?dailymotion\.[a-z]{2,3}\/(?:(?:embed|swf|crawler)\/)?video\/|www\.dailymotion\.com\/player(?:\/[\da-z]+)?\.html\?(?:video|playlist)=)(?<id>[^/?_&#]+)/i;
const CLIENT_ID = "f5a1436a495620be79207b4e189aceaf";
const CLIENT_SECRET = "eea605b96e01c796ff369935357eca920c5da4c5";
class DailymotionIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "dailymotion";
    static IE_DESC = "Dailymotion";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — progressive + HLS`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async getAccessToken(videoId) {
        try {
            const body = new URLSearchParams({
                grant_type: "client_credentials",
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
            });
            const res = await this.request.json("https://graphql.api.dailymotion.com/oauth/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: body.toString(),
            });
            return res.access_token || null;
        }
        catch {
            // Fall back to yt-dlp neon client pair
            try {
                const body = new URLSearchParams({
                    grant_type: "client_credentials",
                    client_id: "f1a362d288c1b98099c7",
                    client_secret: CLIENT_SECRET,
                });
                const res = await this.request.json("https://graphql.api.dailymotion.com/oauth/token", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: body.toString(),
                });
                return res.access_token || null;
            }
            catch {
                return null;
            }
        }
    }
    async extract(url) {
        const id = (0, helpers_1.matchId)(url, VALID_URL);
        const token = await this.getAccessToken(id);
        const headers = {};
        if (token)
            headers.Authorization = `Bearer ${token}`;
        const metadata = await this.request.json(`https://www.dailymotion.com/player/metadata/video/${id}`, {
            query: { app: "com.dailymotion.neon" },
            headers,
        });
        if (metadata.error) {
            throw new Error(metadata.error.title || metadata.error.raw_message || "Dailymotion error");
        }
        const formats = [];
        for (const [quality, mediaList] of Object.entries(metadata.qualities || {})) {
            for (const m of mediaList || []) {
                const mediaUrl = m.url?.split("#")[0];
                if (!mediaUrl || m.type === "application/vnd.lumberjack.manifest")
                    continue;
                if (m.type === "application/x-mpegURL" || /\.m3u8/i.test(mediaUrl)) {
                    formats.push((0, helpers_1.hlsFormat)(mediaUrl, `hls-${quality}`));
                }
                else {
                    const dim = mediaUrl.match(/\/H264-(\d+)x(\d+)/);
                    formats.push((0, helpers_1.progressiveFormat)(mediaUrl, {
                        format_id: `http-${quality}`,
                        width: dim ? Number(dim[1]) : null,
                        height: dim ? Number(dim[2]) : null,
                    }));
                }
            }
        }
        if (!formats.length)
            throw new Error(`No playable formats for Dailymotion video ${id}`);
        const posters = metadata.posters || {};
        const thumb = posters["720"] || posters["480"] || posters["360"] || Object.values(posters)[0];
        return (0, helpers_1.baseInfo)("dailymotion", url, {
            id,
            title: metadata.title || id,
            duration: metadata.duration ?? null,
            uploader: metadata.owner?.screenname || metadata.owner?.username || null,
            thumbnail: thumb,
            formats,
        });
    }
}
exports.DailymotionIE = DailymotionIE;
//# sourceMappingURL=dailymotion.js.map