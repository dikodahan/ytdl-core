"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KickIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VOD_URL = /^https?:\/\/(?:www\.)?kick\.com\/(?<channel>[^/]+)\/videos\/(?<id>[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})/i;
const CLIP_URL = /^https?:\/\/(?:www\.)?kick\.com\/[\w-]+(?:\/clips\/|\/?\?(?:[^#]+&)?clip=)(?<id>clip_[\w-]+)/i;
const VALID_URL = /^https?:\/\/(?:www\.)?kick\.com\/(?:[\w-]+\/videos\/(?<vod_id>[0-9a-f-]{36})|[\w-]+(?:\/clips\/|\/?\?(?:[^#]+&)?clip=)(?<clip_id>clip_[\w-]+))/i;
class KickIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "kick";
    static IE_DESC = "Kick VOD / clips";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — HLS`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const clipMatch = url.match(CLIP_URL);
        if (clipMatch?.groups?.id) {
            return this.extractClip(url, clipMatch.groups.id);
        }
        const vodMatch = url.match(VOD_URL);
        if (!vodMatch?.groups?.id)
            throw new Error(`Could not extract id from URL: ${url}`);
        return this.extractVod(url, vodMatch.groups.id);
    }
    async extractVod(url, videoId) {
        const response = await this.request.json(`https://kick.com/api/v1/video/${videoId}`);
        if (!response.source)
            throw new Error(`No Kick VOD source for ${videoId}`);
        const formats = [(0, helpers_1.hlsFormat)(response.source, "hls")];
        const live = response.livestream;
        return (0, helpers_1.baseInfo)("kick", url, {
            id: videoId,
            title: live?.session_title || live?.slug || videoId,
            description: live?.channel?.user?.bio || null,
            uploader: live?.channel?.user?.username || null,
            uploader_id: live?.channel?.user_id != null ? String(live.channel.user_id) : null,
            duration: live?.duration != null ? live.duration / 1000 : null,
            thumbnail: live?.thumbnail,
            formats,
        });
    }
    async extractClip(url, clipId) {
        const response = await this.request.json(`https://kick.com/api/v2/clips/${clipId}/play`);
        const clip = response.clip;
        if (!clip?.clip_url)
            throw new Error(`No Kick clip url for ${clipId}`);
        const formats = /\.m3u8/i.test(clip.clip_url)
            ? [(0, helpers_1.hlsFormat)(clip.clip_url, "hls")]
            : [(0, helpers_1.progressiveFormat)(clip.clip_url, { format_id: "http" })];
        return (0, helpers_1.baseInfo)("kick", url, {
            id: clipId,
            title: clip.title || clipId,
            uploader: clip.creator?.username || null,
            uploader_id: clip.creator?.id != null ? String(clip.creator.id) : null,
            duration: clip.duration ?? null,
            thumbnail: clip.thumbnail_url,
            formats,
        });
    }
}
exports.KickIE = KickIE;
//# sourceMappingURL=kick.js.map