"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThePlatformIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
class ThePlatformIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "theplatform";
    static IE_DESC = "thePlatform / Paramount media links";
    static _VALID_URL = /(?:https?:\/\/(?:link|player)\.theplatform\.com\/[sp]\/(?<provider>[^/]+)\/(?:(?:(?:[^/]+\/)+select\/)?(?<media>media\/(?:guid\/\d+\/)?)?|(?<config>(?:[^/?]+\/(?:swf|config)|onsite)\/select\/))?|theplatform:)(?<id>[^/?&]+)/i;
    async extract(url) {
        const m = url.match(ThePlatformIE._VALID_URL);
        if (!m?.groups?.id)
            throw new Error(`Could not extract thePlatform id from URL: ${url}`);
        const videoId = m.groups.id;
        const providerId = m.groups.provider || "dJ5BDC";
        let path = `${providerId}/`;
        if (m.groups.media)
            path += m.groups.media;
        path += videoId;
        const formats = [];
        let meta = {};
        try {
            meta = await this.request.json(`https://link.theplatform.com/s/${path}`, { query: { format: "preview" } });
        }
        catch {
            /* preview metadata is best-effort */
        }
        const smilUrl = `https://link.theplatform.com/s/${path}?mbr=true&format=SMIL`;
        try {
            const smil = await this.request.text(smilUrl);
            for (const vm of smil.matchAll(/<(?:video|audio|ref)\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
                const src = vm[1];
                if (!src || src.includes("errorFiles/Unavailable"))
                    continue;
                if (/\.m3u8(\?|$)/i.test(src))
                    formats.push((0, helpers_1.hlsFormat)(src));
                else if (/^https?:/i.test(src))
                    formats.push((0, helpers_1.progressiveFormat)(src));
                else if (/^rtmp/i.test(src)) {
                    formats.push({
                        format_id: "rtmp",
                        url: src,
                        ext: "flv",
                        protocol: "rtmp",
                        has_video: true,
                        has_audio: true,
                        vcodec: "unknown",
                        acodec: "unknown",
                    });
                }
            }
        }
        catch {
            /* SMIL may be geo-blocked */
        }
        // Direct HLS probe
        if (!formats.some(f => f.isHLS)) {
            const hlsProbe = `https://link.theplatform.com/s/${path}?mbr=true&manifest=m3u`;
            formats.push((0, helpers_1.hlsFormat)(hlsProbe));
        }
        if (!formats.length) {
            throw new Error(`thePlatform media ${videoId} has no playable sources`);
        }
        return (0, helpers_1.baseInfo)(ThePlatformIE.IE_NAME, url, {
            id: videoId,
            title: meta.title || videoId,
            description: meta.description || null,
            thumbnail: meta.defaultThumbnailUrl,
            duration: meta.duration != null ? meta.duration / 1000 : null,
            timestamp: meta.pubDate != null ? Math.floor(meta.pubDate / 1000) : null,
            uploader: meta.billingCode || null,
            formats,
        });
    }
}
exports.ThePlatformIE = ThePlatformIE;
//# sourceMappingURL=theplatform.js.map