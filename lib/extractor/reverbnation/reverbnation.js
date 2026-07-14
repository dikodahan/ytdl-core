"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReverbNationIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:www\.)?reverbnation\.com\/.*?\/song\/(?<id>\d+)/i;
class ReverbNationIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "reverbnation";
    static IE_DESC = "ReverbNation songs";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — progressive mp3`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const songId = (0, helpers_1.matchId)(url, VALID_URL);
        const api = await this.request.json(`https://api.reverbnation.com/song/${songId}`);
        if (!api.url)
            throw new Error(`No stream URL for ReverbNation song ${songId}`);
        const formats = [
            (0, helpers_1.progressiveFormat)(api.url, {
                format_id: "http",
                ext: "mp3",
                has_video: false,
                vcodec: "none",
                acodec: "mp3",
            }),
        ];
        return (0, helpers_1.baseInfo)("reverbnation", url, {
            id: songId,
            title: api.name || songId,
            uploader: api.artist?.name || null,
            uploader_id: api.artist?.id != null ? String(api.artist.id) : null,
            thumbnail: api.image || api.thumbnail,
            formats,
        });
    }
}
exports.ReverbNationIE = ReverbNationIE;
//# sourceMappingURL=reverbnation.js.map