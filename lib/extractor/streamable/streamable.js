"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamableIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /https?:\/\/streamable\.com\/(?:[es]\/)?(?<id>\w+)/i;
function absUrl(url) {
    if (!url)
        return undefined;
    if (url.startsWith("//"))
        return `https:${url}`;
    return url;
}
class StreamableIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "streamable";
    static IE_DESC = "Streamable";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — progressive mp4`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const id = (0, helpers_1.matchId)(url, VALID_URL);
        const video = await this.request.json(`https://ajax.streamable.com/videos/${id}`);
        if (video.status !== 2) {
            throw new Error("This Streamable video is currently unavailable. It may still be uploading or processing.");
        }
        const formats = [];
        for (const [key, info] of Object.entries(video.files || {})) {
            const fileUrl = absUrl(info.url);
            if (!fileUrl)
                continue;
            formats.push((0, helpers_1.progressiveFormat)(fileUrl, {
                format_id: key,
                width: info.width ?? null,
                height: info.height ?? null,
                filesize: info.size ?? null,
                fps: info.framerate ?? null,
                tbr: info.bitrate != null ? info.bitrate / 1000 : null,
            }));
        }
        if (!formats.length)
            throw new Error(`No playable formats for Streamable ${id}`);
        return (0, helpers_1.baseInfo)(StreamableIE.IE_NAME, url, {
            id,
            title: video.reddit_title || video.title || id,
            description: video.description || null,
            thumbnail: absUrl(video.thumbnail_url),
            uploader: video.owner?.user_name || null,
            timestamp: video.date_added ?? null,
            duration: video.duration ?? null,
            view_count: video.plays ?? null,
            formats,
        });
    }
}
exports.StreamableIE = StreamableIE;
//# sourceMappingURL=streamable.js.map