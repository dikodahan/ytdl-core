"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArdIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:(?:beta|www)\.)?ardmediathek\.de\/(?:[^/]+\/)?(?:player|live|video)\/(?:[^?#]+\/)?(?<id>[a-zA-Z0-9]+)\/?(?:[?#]|$)/i;
class ArdIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "ard";
    static IE_DESC = "ARD Mediathek";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — HLS / progressive (Germany geo)`,
            validUrl: String(this._VALID_URL),
            options: [],
            notes: "Often geo-restricted to Germany.",
        };
    }
    async extract(url) {
        const displayId = (0, helpers_1.matchId)(url, VALID_URL);
        const page = await this.request.json(`https://api.ardmediathek.de/page-gateway/pages/ard/item/${displayId}`, { query: { embedded: "false", mcV6: "true" } });
        const player = (page.widgets || []).find(w => w.type === "player_ondemand" || w.type === "player_live");
        if (!player)
            throw new Error(`ARD Mediathek player data missing for ${displayId}`);
        if (player.blockedByFsk) {
            throw new Error("ARD video is age-restricted (FSK); available for age-verified users or after 22:00");
        }
        const media = player.mediaCollection?.embedded;
        const formats = [];
        for (const stream of media?.streams || []) {
            const kind = stream.kind || "main";
            for (const m of stream.media || []) {
                if (!m.url)
                    continue;
                if (/\.m3u8(\?|$)/i.test(m.url)) {
                    formats.push((0, helpers_1.hlsFormat)(m.url, `hls-${kind}`));
                }
                else if (/^https?:/i.test(m.url)) {
                    formats.push((0, helpers_1.progressiveFormat)(m.url, {
                        format_id: `http-${kind}`,
                        width: m.maxHResolutionPx ?? null,
                        height: m.maxVResolutionPx ?? null,
                        vcodec: m.videoCodec || "unknown",
                    }));
                }
            }
        }
        if (!formats.length) {
            throw new Error(`ARD Mediathek ${displayId} has no playable formats (possibly geo-restricted to DE)`);
        }
        const meta = media?.meta || {};
        const contentId = page.tracking?.atiCustomVars?.contentId;
        const videoId = contentId != null ? String(contentId) : displayId;
        return (0, helpers_1.baseInfo)("ard", url, {
            id: videoId,
            display_id: displayId,
            title: meta.title || page.title || videoId,
            description: meta.synopsis || null,
            duration: meta.durationSeconds ?? null,
            thumbnail: meta.images?.[0]?.url,
            uploader: meta.clipSourceName || null,
            formats,
        });
    }
}
exports.ArdIE = ArdIE;
//# sourceMappingURL=ard.js.map