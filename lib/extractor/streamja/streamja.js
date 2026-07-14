"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamjaIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /https?:\/\/(?:www\.)?streamja\.com\/(?<id>[a-zA-Z0-9]+)/i;
class StreamjaIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "streamja";
    static IE_DESC = "Streamja";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — progressive mp4`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const id = (0, helpers_1.matchId)(url, VALID_URL);
        const webpage = await this.request.text(url);
        const formats = [];
        for (const sm of webpage.matchAll(/<(?:source|video)[^>]+src=["']([^"']+)["']/gi)) {
            const src = sm[1].startsWith("//") ? `https:${sm[1]}` : sm[1];
            if (!/^https?:/i.test(src))
                continue;
            formats.push((0, helpers_1.progressiveFormat)(src, {
                format_id: /\.m3u8/i.test(src) ? "hls" : "http",
                protocol: /\.m3u8/i.test(src) ? "m3u8_native" : "https",
                isHLS: /\.m3u8/i.test(src),
            }));
        }
        const ogVideo = webpage.match(/<meta[^>]+property=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i)?.[1];
        if (ogVideo) {
            formats.push((0, helpers_1.progressiveFormat)(ogVideo, { format_id: "og" }));
        }
        if (!formats.length) {
            for (const pm of webpage.matchAll(/https?:\/\/[^"'\\\s]+\.mp4[^"'\\\s]*/gi)) {
                formats.push((0, helpers_1.progressiveFormat)(pm[0]));
            }
        }
        if (!formats.length)
            throw new Error(`No playable formats for Streamja ${id}`);
        const title = webpage.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
            webpage.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ||
            id;
        const thumbnail = webpage.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
        return (0, helpers_1.baseInfo)(StreamjaIE.IE_NAME, url, {
            id,
            title: title.replace(/\s*[|-]\s*Streamja\s*$/i, "").trim() || id,
            thumbnail,
            formats,
        });
    }
}
exports.StreamjaIE = StreamjaIE;
//# sourceMappingURL=streamja.js.map