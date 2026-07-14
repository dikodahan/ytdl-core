"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AcastIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:(?:(?:embed|www|shows)\.)?acast\.com\/|play\.acast\.com\/s\/)(?<channel>[^/?#]+)\/(?:episodes\/)?(?<id>[^/#?"]+)/i;
function stripHtml(html) {
    if (!html)
        return null;
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null;
}
class AcastIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "acast";
    static IE_DESC = "Acast podcasts";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — progressive audio`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const m = url.match(VALID_URL);
        if (!m?.groups?.channel || !m.groups.id) {
            throw new Error(`Could not extract id from URL: ${url}`);
        }
        const channel = m.groups.channel;
        const displayId = m.groups.id;
        const episode = await this.request.json(`https://feeder.acast.com/api/v1/shows/${channel}/episodes/${displayId}`, { query: { showInfo: "true" } });
        if (!episode.url)
            throw new Error(`No stream URL for Acast episode ${displayId}`);
        const formats = [
            (0, helpers_1.progressiveFormat)(episode.url, {
                format_id: "http",
                ext: "mp3",
                has_video: false,
                vcodec: "none",
                acodec: "mp3",
                filesize: episode.contentLength ?? null,
            }),
        ];
        return (0, helpers_1.baseInfo)("acast", url, {
            id: episode.id || displayId,
            display_id: episode.episodeUrl || displayId,
            title: episode.title || displayId,
            description: stripHtml(episode.description || episode.summary),
            thumbnail: episode.image,
            duration: episode.duration ?? null,
            uploader: episode.show?.author || null,
            formats,
        });
    }
}
exports.AcastIE = AcastIE;
//# sourceMappingURL=acast.js.map