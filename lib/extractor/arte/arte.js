"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArteIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const LANGS = "fr|de|en|es|it|pl";
const VALID_URL = new RegExp(`^(?:https?:\\/\\/(?:(?:www\\.)?arte\\.tv\\/(?<lang>${LANGS})\\/videos|api\\.arte\\.tv\\/api\\/player\\/v\\d+\\/config\\/(?<lang_2>${LANGS}))|arte:\\/\\/program)\\/(?<id>\\d{6}-\\d{3}-[AF]|LIVE)`, "i");
const API_BASE = "https://api.arte.tv/api/player/v2";
const COUNTRIES_MAP = {
    DE_FR: ["DE", "FR"],
    EUR_DE_FR: ["AT", "CH", "DE", "FR"],
    SAT: ["DE", "FR", "GB", "IT", "ES", "PL"],
};
class ArteIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "arte";
    static IE_DESC = "Arte.tv";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — HLS / progressive`,
            validUrl: String(this._VALID_URL),
            options: [],
            notes: "May be geo-restricted depending on rights territory.",
        };
    }
    async extract(url) {
        const m = url.match(VALID_URL);
        const videoId = m?.groups?.id;
        const lang = m?.groups?.lang || m?.groups?.lang_2 || "en";
        if (!videoId)
            throw new Error(`Could not extract id from URL: ${url}`);
        const config = await this.request.json(`${API_BASE}/config/${lang}/${videoId}`, { headers: { "x-validated-age": "18" } });
        const attrs = config.data?.attributes;
        const geo = attrs?.restriction?.geoblocking;
        if (geo?.restrictedArea) {
            const code = geo.code || "DE_FR";
            const countries = (COUNTRIES_MAP[code] || ["DE", "FR"]).join(", ");
            throw new Error(`Arte video is geo-restricted to ${code} (${countries})`);
        }
        if (!attrs?.rights) {
            throw new Error("Arte video is not available in this language edition or broadcast rights expired");
        }
        const formats = [];
        for (const stream of attrs.streams || []) {
            if (!stream.url)
                continue;
            const version = stream.versions?.[0];
            const verCode = version?.eStat?.ml5 || "unknown";
            const note = version?.label || version?.shortLabel || verCode;
            if (stream.protocol && /HLS/i.test(stream.protocol)) {
                formats.push((0, helpers_1.hlsFormat)(stream.url, `hls-${verCode}`));
                formats[formats.length - 1].format_note = note;
            }
            else if (stream.protocol === "HTTPS" || stream.protocol === "RTMP") {
                formats.push((0, helpers_1.progressiveFormat)(stream.url, {
                    format_id: `${stream.protocol}-${verCode}`,
                    format_note: note,
                }));
            }
        }
        if (!formats.length) {
            throw new Error(`Arte ${videoId} has no playable streams`);
        }
        const meta = attrs.metadata || {};
        return (0, helpers_1.baseInfo)("arte", url, {
            id: meta.providerId || videoId,
            title: meta.subtitle || meta.title || videoId,
            description: meta.description || null,
            duration: meta.duration?.seconds ?? null,
            thumbnail: meta.images?.[0]?.url,
            is_live: attrs.live || false,
            formats,
        });
    }
}
exports.ArteIE = ArteIE;
//# sourceMappingURL=arte.js.map