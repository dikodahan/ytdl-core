"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudiusIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:www\.)?audius\.co\/(?<uploader>[\w\d-]+)(?!\/album|\/playlist)\/(?<title>\S+)/i;
class AudiusIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "audius";
    static IE_DESC = "Audius tracks";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — progressive stream`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async selectApiBase() {
        const resp = await this.request.json("https://api.audius.co/");
        const hosts = resp.data;
        if (!Array.isArray(hosts) || !hosts.length) {
            throw new Error("Unable to get available Audius API hosts");
        }
        return hosts[Math.floor(Math.random() * hosts.length)];
    }
    prepareUrl(pageUrl, title) {
        const decodedUrl = decodeURIComponent(pageUrl);
        const decodedTitle = decodeURIComponent(title);
        if (decodedTitle.includes("/") || title.includes("%2F")) {
            const fixedTitle = decodedTitle.replace(/\//g, "%5C").replace(/%2F/gi, "%5C");
            return decodedUrl.replace(decodedTitle, fixedTitle);
        }
        return decodedUrl;
    }
    async extract(url) {
        const m = url.match(VALID_URL);
        if (!m?.groups?.title)
            throw new Error(`Could not extract id from URL: ${url}`);
        const titleSlug = m.groups.title;
        const resolveUrl = this.prepareUrl(url.split(/[?#]/)[0] || url, titleSlug);
        const apiBase = await this.selectApiBase();
        const trackData = await this.request.json(`${apiBase}/v1/resolve`, { query: { url: resolveUrl } });
        const track = trackData.data ?? trackData;
        if (!track || typeof track !== "object" || !track.id) {
            throw new Error("Unable to resolve Audius track");
        }
        const trackId = track.id;
        const streamUrl = `${apiBase}/v1/tracks/${trackId}/stream`;
        const formats = [
            (0, helpers_1.progressiveFormat)(streamUrl, {
                format_id: "http",
                ext: "mp3",
                has_video: false,
                vcodec: "none",
                acodec: "mp3",
            }),
        ];
        let thumbnail;
        if (track.artwork && typeof track.artwork === "object") {
            thumbnail =
                track.artwork["1000x1000"] ||
                    track.artwork["480x480"] ||
                    track.artwork["150x150"] ||
                    Object.values(track.artwork)[0];
        }
        return (0, helpers_1.baseInfo)("audius", url, {
            id: trackId,
            title: track.title || titleSlug,
            description: track.description || null,
            duration: track.duration ?? null,
            uploader: track.user?.name || m.groups.uploader || null,
            thumbnail,
            formats,
        });
    }
}
exports.AudiusIE = AudiusIE;
//# sourceMappingURL=audius.js.map