"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NinegagIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:www\.)?9gag\.com\/gag\/(?<id>[^/?&#]+)/i;
function decodeHtml(s) {
    return s
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}
function guessExt(url) {
    return url.split("?")[0]?.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
}
class NinegagIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "ninegag";
    static IE_DESC = "9GAG";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — Animated progressive`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const id = (0, helpers_1.matchId)(url, VALID_URL);
        const payload = await this.request.json("https://9gag.com/v1/post", { query: { id } });
        const post = payload.data?.post;
        if (!post)
            throw new Error(`9GAG post not found: ${id}`);
        if (post.type !== "Animated") {
            throw new Error(`9GAG post ${id} is not Animated (no video)`);
        }
        const formats = [];
        let duration = null;
        let thumbnail;
        for (const [key, image] of Object.entries(post.images || {})) {
            const imageUrl = image.url;
            if (!imageUrl)
                continue;
            const ext = guessExt(imageUrl);
            const imageId = key.replace(/^image/, "") || key;
            if (ext === "jpg" || ext === "png") {
                if (!thumbnail)
                    thumbnail = image.webpUrl || imageUrl;
                continue;
            }
            if (ext !== "webm" && ext !== "mp4")
                continue;
            if (duration == null && image.duration != null)
                duration = image.duration;
            const common = {
                width: image.width ?? null,
                height: image.height ?? null,
                has_audio: image.hasAudio !== 0,
                acodec: image.hasAudio === 0 ? "none" : "unknown",
            };
            for (const [vcodec, vUrl] of [
                ["vp8", image.vp8Url],
                ["vp9", image.vp9Url],
                ["h265", image.h265Url],
            ]) {
                if (!vUrl)
                    continue;
                formats.push((0, helpers_1.progressiveFormat)(vUrl, {
                    format_id: `${imageId}-${vcodec}`,
                    vcodec,
                    ...common,
                }));
            }
            formats.push((0, helpers_1.progressiveFormat)(imageUrl, {
                format_id: imageId,
                ext,
                ...common,
            }));
        }
        if (!formats.length)
            throw new Error(`No playable formats for 9GAG post ${id}`);
        return (0, helpers_1.baseInfo)("ninegag", url, {
            id,
            title: post.title ? decodeHtml(post.title) : id,
            uploader: post.creator?.fullName || post.creator?.username || null,
            uploader_id: post.creator?.username || null,
            duration,
            thumbnail,
            formats,
        });
    }
}
exports.NinegagIE = NinegagIE;
//# sourceMappingURL=ninegag.js.map