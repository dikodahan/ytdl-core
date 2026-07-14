"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoubIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^(?:coub:|https?:\/\/(?:coub\.com\/(?:view|embed|coubs)\/|c-cdn\.coub\.com\/fb-player\.swf\?.*\bcoub(?:ID|id)=))(?<id>[\da-z]+)/i;
class CoubIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "coub";
    static IE_DESC = "Coub";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — html5 video urls`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const id = (0, helpers_1.matchId)(url, VALID_URL);
        const coub = await this.request.json(`https://coub.com/api/v2/coubs/${id}.json`);
        if (coub.error)
            throw new Error(`coub said: ${coub.error}`);
        const formats = [];
        const html5 = coub.file_versions?.html5 || {};
        for (const kind of ["video", "audio"]) {
            const items = html5[kind];
            if (!items || typeof items !== "object")
                continue;
            for (const [quality, item] of Object.entries(items)) {
                if (!item?.url)
                    continue;
                formats.push((0, helpers_1.progressiveFormat)(item.url, {
                    format_id: `html5-${kind}-${quality}`,
                    filesize: item.size ?? null,
                    has_video: kind === "video",
                    has_audio: kind === "audio",
                    vcodec: kind === "audio" ? "none" : "unknown",
                    acodec: kind === "video" ? "none" : "unknown",
                }));
            }
        }
        const iphoneUrl = coub.file_versions?.iphone?.url;
        if (iphoneUrl) {
            formats.push((0, helpers_1.progressiveFormat)(iphoneUrl, { format_id: "iphone" }));
        }
        if (!formats.length)
            throw new Error(`No playable formats for Coub ${id}`);
        return (0, helpers_1.baseInfo)("coub", url, {
            id,
            title: coub.title || id,
            uploader: coub.channel?.title || null,
            uploader_id: coub.channel?.permalink || null,
            thumbnail: coub.picture,
            duration: coub.duration ?? null,
            formats,
        });
    }
}
exports.CoubIE = CoubIE;
//# sourceMappingURL=coub.js.map