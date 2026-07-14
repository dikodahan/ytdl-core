"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Art19IE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const UUID = "[\\da-f]{8}-?[\\da-f]{4}-?[\\da-f]{4}-?[\\da-f]{4}-?[\\da-f]{12}";
const VALID_URL = new RegExp(`^https?:\\/\\/(?:(?:www\\.)?art19\\.com\\/shows\\/[^/#?]+\\/episodes\\/(?<id>${UUID})|rss\\.art19\\.com\\/episodes\\/(?<id2>${UUID})\\.mp3)`, "i");
class Art19IE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "art19";
    static IE_DESC = "ART19 podcast episodes";
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
        const m = url.match(VALID_URL);
        const episodeId = m?.groups?.id || m?.groups?.id2 || (0, helpers_1.matchId)(url, VALID_URL);
        if (!episodeId)
            throw new Error(`Could not extract id from URL: ${url}`);
        let player = null;
        let rss = null;
        try {
            player = await this.request.json(`https://art19.com/episodes/${episodeId}`, { headers: { Accept: "application/vnd.art19.v0+json" } });
        }
        catch {
            /* optional */
        }
        try {
            rss = await this.request.json(`https://rss.art19.com/episodes/${episodeId}.json`);
        }
        catch {
            /* optional */
        }
        const formats = [
            (0, helpers_1.progressiveFormat)(`https://rss.art19.com/episodes/${episodeId}.mp3`, {
                format_id: "direct",
                ext: "mp3",
                has_video: false,
                vcodec: "none",
                acodec: "mp3",
            }),
        ];
        const media = rss?.content?.media;
        if (media && typeof media === "object") {
            for (const [fmtId, fmtData] of Object.entries(media)) {
                if (fmtId === "waveform_bin" || !fmtData?.url)
                    continue;
                formats.push((0, helpers_1.progressiveFormat)(fmtData.url, {
                    format_id: fmtId,
                    has_video: false,
                    vcodec: "none",
                    acodec: fmtId,
                }));
            }
        }
        const title = player?.episode?.title || rss?.content?.episode_title || episodeId;
        return (0, helpers_1.baseInfo)("art19", url, {
            id: episodeId,
            title,
            description: player?.episode?.description_plain ||
                rss?.content?.episode_description_plain ||
                null,
            duration: rss?.content?.duration ?? null,
            thumbnail: rss?.content?.cover_image,
            formats,
        });
    }
}
exports.Art19IE = Art19IE;
//# sourceMappingURL=art19.js.map