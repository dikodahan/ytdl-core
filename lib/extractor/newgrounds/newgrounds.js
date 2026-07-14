"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewgroundsIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:www\.)?newgrounds\.com\/portal\/view\/(?<id>\d+)/i;
class NewgroundsIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "newgrounds";
    static IE_DESC = "Newgrounds portal";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — quality source arrays`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const id = (0, helpers_1.matchId)(url, VALID_URL);
        // Warm cookies / age-gate state before the JSON endpoint.
        await this.request.text(url, {
            headers: { Accept: "text/html,application/xhtml+xml" },
        });
        const json = await this.request.json(`https://www.newgrounds.com/portal/video/${id}`, {
            headers: {
                Accept: "application/json, text/javascript, */*; q=0.01",
                Referer: url,
                "X-Requested-With": "XMLHttpRequest",
            },
        });
        const formats = [];
        for (const [formatId, sources] of Object.entries(json.sources || {})) {
            const height = Number.parseInt(formatId, 10);
            for (const source of sources || []) {
                if (!source.src)
                    continue;
                formats.push((0, helpers_1.progressiveFormat)(source.src, {
                    format_id: formatId,
                    height: Number.isFinite(height) ? height : null,
                }));
            }
        }
        if (!formats.length)
            throw new Error(`No playable formats for Newgrounds ${id}`);
        return (0, helpers_1.baseInfo)("newgrounds", url, {
            id,
            title: json.title || id,
            uploader: json.author || null,
            thumbnail: json.image,
            duration: json.duration ?? null,
            formats,
        });
    }
}
exports.NewgroundsIE = NewgroundsIE;
//# sourceMappingURL=newgrounds.js.map