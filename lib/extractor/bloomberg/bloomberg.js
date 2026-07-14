"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BloombergIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:www\.)?bloomberg\.com\/(?:[^/]+\/)*(?<id>[^/?#]+)/i;
function og(webpage, prop) {
    return (webpage.match(new RegExp(`property=["']og:${prop}["']\\s+content=["']([^"']+)`, "i"))?.[1] ||
        webpage.match(new RegExp(`content=["']([^"']+)["']\\s+property=["']og:${prop}["']`, "i"))?.[1] ||
        null);
}
class BloombergIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "bloomberg";
    static IE_DESC = "Bloomberg.com videos";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — HLS streams`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const name = (0, helpers_1.matchId)(url, VALID_URL);
        const webpage = await this.request.text(url);
        let videoId = webpage.match(/["']bmmrId["']\s*:\s*["'](?<id>[^"']+)["']/i)?.groups?.id ||
            webpage.match(/videoId\s*:\s*["'](?<id>[^"']+)["']/i)?.groups?.id ||
            webpage.match(/data-bmmrid=["'](?<id>[^"']+)["']/i)?.groups?.id ||
            null;
        if (!videoId) {
            const bp = webpage.match(/BPlayer\(\s*null\s*,\s*/i);
            if (bp && bp.index != null) {
                const brace = webpage.indexOf("{", bp.index);
                const data = (0, helpers_1.extractJsonObject)(webpage, brace);
                videoId = data?.id || null;
            }
        }
        if (!videoId)
            throw new Error(`Could not find Bloomberg video id on ${name}`);
        const embed = await this.request.json(`https://www.bloomberg.com/multimedia/api/embed?id=${encodeURIComponent(videoId)}`);
        const formats = [];
        for (const stream of embed.streams || []) {
            if (!stream.url)
                continue;
            if (stream.muxing_format === "TS" || /\.m3u8(\?|$)/i.test(stream.url)) {
                formats.push((0, helpers_1.hlsFormat)(stream.url));
            }
            // Skip HDS/f4m — not useful for VLC-oriented extract
        }
        if (!formats.length) {
            throw new Error(`Bloomberg video ${videoId} has no HLS streams`);
        }
        const title = (og(webpage, "title") || name).replace(/: Video$/i, "");
        return (0, helpers_1.baseInfo)("bloomberg", url, {
            id: videoId,
            title,
            description: og(webpage, "description"),
            thumbnail: og(webpage, "image") || undefined,
            formats,
        });
    }
}
exports.BloombergIE = BloombergIE;
//# sourceMappingURL=bloomberg.js.map