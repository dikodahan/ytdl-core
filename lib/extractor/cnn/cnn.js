"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CnnIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:(?:edition|www|money|cnnespanol)\.)?cnn\.com\/(?!audio\/)(?<display_id>[^?#]+?)(?:[?#]|$|\/index\.html)/i;
function parseAttr(tag, name) {
    return (tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"))?.[1] ||
        tag.match(new RegExp(`\\b${name}=([^\\s>]+)`, "i"))?.[1] ||
        null);
}
class CnnIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "cnn";
    static IE_DESC = "CNN video pages";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — progressive MP4 / HLS`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const displayId = url.match(VALID_URL)?.groups?.display_id;
        if (!displayId)
            throw new Error(`Could not extract id from URL: ${url}`);
        const webpage = await this.request.text(url);
        const env = webpage.match(/window\.env\s*=\s*(\{[\s\S]*?\});/);
        const appId = (env ? (0, helpers_1.tryParseJson)(env[1] || "") : null)
            ?.TOP_AUTH_SERVICE_APP_ID || null;
        const playerTags = [
            ...webpage.matchAll(/<div\b[^>]*\bdata-component-name=["']video-player["'][^>]*>/gi),
        ];
        const entries = [];
        for (const tagMatch of playerTags) {
            const tag = tagMatch[0];
            const mediaId = parseAttr(tag, "data-media-id");
            if (!mediaId)
                continue;
            const parentUri = parseAttr(tag, "data-video-resource-parent-uri");
            const formats = [];
            let videoData = {};
            if (parentUri) {
                try {
                    videoData = await this.request.json("https://fave.api.cnn.io/v1/video", { query: { id: mediaId, stellarUri: parentUri } });
                    for (const file of videoData.files || []) {
                        if (!file.fileUri)
                            continue;
                        const m = file.fileUri.match(/-(?<res>\d+x\d+)_(?<tbr>\d+)k\.mp4/i);
                        const [w, h] = m?.groups?.res?.split("x").map(Number) || [];
                        formats.push((0, helpers_1.progressiveFormat)(file.fileUri, {
                            format_id: "direct",
                            tbr: m?.groups?.tbr ? Number(m.groups.tbr) : null,
                            width: w || null,
                            height: h || null,
                        }));
                    }
                }
                catch {
                    /* best-effort */
                }
            }
            if (appId) {
                try {
                    const mediaData = await this.request.json(`https://medium.ngtv.io/v2/media/${mediaId}/desktop`, { query: { appId } });
                    const m3u8 = mediaData.media?.desktop?.unprotected?.unencrypted?.url;
                    if (m3u8)
                        formats.push((0, helpers_1.hlsFormat)(m3u8));
                }
                catch {
                    /* best-effort */
                }
            }
            if (!formats.length)
                continue;
            let thumb;
            const poster = parseAttr(tag, "data-poster-image-override");
            if (poster) {
                try {
                    const parsed = (0, helpers_1.tryParseJson)(poster);
                    thumb = parsed?.big?.uri;
                }
                catch {
                    /* ignore */
                }
            }
            const durRaw = parseAttr(tag, "data-duration");
            const duration = videoData.trt ??
                (durRaw
                    ? (() => {
                        const parts = durRaw.split(":").map(Number);
                        if (parts.some(n => !Number.isFinite(n)))
                            return null;
                        if (parts.length === 3)
                            return parts[0] * 3600 + parts[1] * 60 + parts[2];
                        if (parts.length === 2)
                            return parts[0] * 60 + parts[1];
                        return Number(durRaw) || null;
                    })()
                    : null);
            entries.push({
                id: mediaId,
                title: parseAttr(tag, "data-headline") ||
                    videoData.headline ||
                    mediaId,
                description: parseAttr(tag, "data-description") || videoData.description || null,
                duration,
                thumbnail: thumb,
                formats,
            });
        }
        if (!entries.length) {
            throw new Error(`No playable CNN video found on ${displayId}`);
        }
        // VLC single-video: take the first / featured player
        const entry = entries[0];
        return (0, helpers_1.baseInfo)("cnn", url, {
            id: entry.id,
            display_id: displayId,
            title: entry.title,
            description: entry.description,
            duration: entry.duration,
            thumbnail: entry.thumbnail,
            formats: entry.formats,
        });
    }
}
exports.CnnIE = CnnIE;
//# sourceMappingURL=cnn.js.map