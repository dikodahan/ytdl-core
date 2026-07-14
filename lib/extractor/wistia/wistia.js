"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WistiaIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
class WistiaIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "wistia";
    static IE_DESC = "Wistia embeds";
    static _VALID_URL = /(?:wistia:|https?:\/\/(?:\w+\.)?wistia\.(?:net|com)\/(?:embed\/)?(?:iframe|medias)\/)(?<id>[a-z0-9]{10})/i;
    async extract(url) {
        const id = (0, helpers_1.matchId)(url, WistiaIE._VALID_URL);
        const embedUrl = `http://fast.wistia.net/embed/medias/${id}.json`;
        const config = await this.request.json(embedUrl, {
            headers: {
                Referer: url.startsWith("http") ? url : embedUrl,
            },
        });
        if (config.error) {
            throw new Error(`Wistia error: ${config.error}`);
        }
        const media = config.media;
        if (!media?.assets?.length) {
            throw new Error(`Wistia media ${id} has no assets`);
        }
        const formats = [];
        const thumbnails = [];
        for (const asset of media.assets) {
            const aurl = asset.url;
            if (!aurl)
                continue;
            if (asset.status != null && asset.status !== 2)
                continue;
            const atype = asset.type || "";
            if (atype === "preview" || atype === "storyboard")
                continue;
            if (atype === "still" || atype === "still_image") {
                thumbnails.push({
                    url: aurl.replace(/\.bin(\?|$)/i, ".jpg$1"),
                    width: asset.width,
                    height: asset.height,
                });
                continue;
            }
            const isHls = asset.container === "m3u8" ||
                asset.ext === "m3u8" ||
                /\.m3u8(\?|$)/i.test(aurl);
            if (isHls) {
                formats.push((0, helpers_1.hlsFormat)(aurl.replace(/\.bin(\?|$)/i, ".m3u8$1"), atype || "hls"));
            }
            else {
                const isAudio = asset.display_name === "Audio";
                formats.push((0, helpers_1.progressiveFormat)(aurl, {
                    format_id: atype || "http",
                    ext: asset.ext || undefined,
                    width: asset.width ?? null,
                    height: asset.height ?? null,
                    tbr: asset.bitrate ?? null,
                    filesize: asset.size ?? null,
                    has_video: !isAudio,
                    vcodec: isAudio ? "none" : asset.codec || "unknown",
                }));
            }
        }
        if (!formats.length) {
            throw new Error(`Wistia media ${id} has no playable formats`);
        }
        return (0, helpers_1.baseInfo)(WistiaIE.IE_NAME, url, {
            id: media.hashedId || id,
            title: media.name || id,
            description: media.seoDescription || null,
            duration: media.duration ?? null,
            thumbnail: thumbnails[0]?.url,
            thumbnails: thumbnails.length ? thumbnails : undefined,
            formats,
        });
    }
}
exports.WistiaIE = WistiaIE;
//# sourceMappingURL=wistia.js.map