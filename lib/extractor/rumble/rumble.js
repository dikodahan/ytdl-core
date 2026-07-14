"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RumbleIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const EMBED_URL = /^https?:\/\/(?:www\.)?rumble\.com\/embed\/(?:[^-]+-)?(?<id>v[a-zA-Z0-9]+)/i;
const PAGE_URL = /^https?:\/\/(?:www\.)?rumble\.com\/v(?!ideos)(?<id>[^.?#]+)/i;
const VALID_URL = /^https?:\/\/(?:www\.)?rumble\.com\/(?:embed\/(?:[^-]+-)?(?<embed_id>v[a-zA-Z0-9]+)|v(?!ideos)(?<page_id>[^.?#]+))/i;
function decodeHtml(s) {
    return s
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}
class RumbleIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "rumble";
    static IE_DESC = "Rumble";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — progressive + HLS`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async resolveEmbedId(url) {
        const embed = url.match(EMBED_URL);
        if (embed?.groups?.id)
            return embed.groups.id;
        const page = url.match(PAGE_URL);
        if (!page)
            throw new Error(`Could not extract id from URL: ${url}`);
        const webpage = await this.request.text(url);
        const fromEmbed = webpage.match(/rumble\.com\/embed\/(?:[^-/"']+-)?(v[a-zA-Z0-9]+)/i)?.[1] ||
            webpage.match(/["']embedUrl["']\s*:\s*["'][^"']*\/embed\/(?:[^-/"']+-)?(v[a-zA-Z0-9]+)/i)?.[1] ||
            webpage.match(/Rumble\(\s*"play"\s*,\s*\{[^}]*["']?video["']?\s*:\s*["'](v?[0-9a-z]+)["']/i)?.[1];
        if (!fromEmbed)
            throw new Error(`Could not find Rumble embed id on page ${page.groups?.id}`);
        return fromEmbed.startsWith("v") ? fromEmbed : `v${fromEmbed}`;
    }
    async extract(url) {
        const videoId = await this.resolveEmbedId(url);
        const video = await this.request.json("https://rumble.com/embedJS/u3/", {
            query: { request: "video", ver: 2, v: videoId },
        });
        const formats = [];
        for (const [formatType, formatInfo] of Object.entries(video.ua || {})) {
            if (formatType === "tar")
                continue;
            const items = Array.isArray(formatInfo)
                ? formatInfo
                : Object.entries(formatInfo).map(([height, info]) => {
                    const meta = { ...(info.meta || {}) };
                    if (meta.h == null)
                        meta.h = Number(height) || height;
                    return { ...info, meta };
                });
            for (const info of items) {
                if (!info.url)
                    continue;
                const meta = info.meta || {};
                const height = meta.h != null ? Number(meta.h) : null;
                const formatId = height ? `${formatType}-${height}p` : formatType;
                if (formatType === "hls" || /\.m3u8/i.test(info.url)) {
                    formats.push({
                        ...(0, helpers_1.hlsFormat)(info.url, formatId),
                        height: Number.isFinite(height) ? height : null,
                        width: meta.w != null ? Number(meta.w) || null : null,
                        tbr: meta.bitrate ?? null,
                        filesize: meta.size ?? null,
                    });
                }
                else {
                    formats.push((0, helpers_1.progressiveFormat)(info.url, {
                        format_id: formatId,
                        height: Number.isFinite(height) ? height : null,
                        width: meta.w != null ? Number(meta.w) || null : null,
                        tbr: meta.bitrate ?? null,
                        filesize: meta.size ?? null,
                        has_video: formatType !== "audio",
                        has_audio: formatType !== "timeline",
                        vcodec: formatType === "audio" ? "none" : "unknown",
                        acodec: formatType === "timeline" || formatType === "audio" ? (formatType === "timeline" ? "none" : "unknown") : "unknown",
                    }));
                }
            }
        }
        if (!formats.length)
            throw new Error(`No playable formats for Rumble video ${videoId}`);
        return (0, helpers_1.baseInfo)("rumble", url, {
            id: videoId,
            title: video.title ? decodeHtml(video.title) : videoId,
            uploader: video.author?.name || null,
            duration: video.duration ?? null,
            thumbnail: video.i,
            formats,
        });
    }
}
exports.RumbleIE = RumbleIE;
//# sourceMappingURL=rumble.js.map