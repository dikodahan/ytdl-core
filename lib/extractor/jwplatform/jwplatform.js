"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWPlatformIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
class JWPlatformIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "jwplatform";
    static IE_DESC = "JW Player / JW Platform CDN embeds";
    static _VALID_URL = /(?:https?:\/\/(?:content\.jwplatform|cdn\.jwplayer)\.com\/(?:(?:feed|player|thumb|preview|manifest)s|jw6|v2\/media)\/|jwplatform:)(?<id>[a-zA-Z0-9]{8})/i;
    async extract(url) {
        const id = (0, helpers_1.matchId)(url, JWPlatformIE._VALID_URL);
        const data = await this.request.json(`https://cdn.jwplayer.com/v2/media/${id}`);
        const item = data.playlist?.[0] || {};
        const formats = [];
        for (const source of item.sources || []) {
            const file = source.file;
            if (!file)
                continue;
            const type = (source.type || "").toLowerCase();
            if (type.includes("mpegurl") || /\.m3u8(\?|$)/i.test(file)) {
                formats.push((0, helpers_1.hlsFormat)(file));
            }
            else if (type.includes("dash") || /\.mpd(\?|$)/i.test(file)) {
                formats.push((0, helpers_1.dashFormat)(file));
            }
            else {
                formats.push((0, helpers_1.progressiveFormat)(file, {
                    format_id: source.label || "http",
                    width: source.width ?? null,
                    height: source.height ?? null,
                }));
            }
        }
        if (!formats.length) {
            throw new Error(`JW Platform media ${id} has no playable sources`);
        }
        return (0, helpers_1.baseInfo)(JWPlatformIE.IE_NAME, url, {
            id,
            title: item.title || data.title || id,
            description: item.description || data.description || null,
            thumbnail: item.image,
            duration: item.duration ?? null,
            formats,
        });
    }
}
exports.JWPlatformIE = JWPlatformIE;
//# sourceMappingURL=jwplatform.js.map