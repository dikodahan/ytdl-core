"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PixeldrainIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /https?:\/\/(?:www\.)?pixeldrain\.com\/(?:u|api\/file)\/(?<id>[0-9a-zA-Z]+)/i;
function mimeExt(mime) {
    if (!mime)
        return undefined;
    if (mime.includes("mp4"))
        return "mp4";
    if (mime.includes("webm"))
        return "webm";
    if (mime.includes("mpeg") || mime.includes("mp3"))
        return "mp3";
    if (mime.includes("m4a"))
        return "m4a";
    return mime.split("/")[1]?.split(";")[0];
}
class PixeldrainIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "pixeldrain";
    static IE_DESC = "Pixeldrain";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — progressive download`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const id = (0, helpers_1.matchId)(url, VALID_URL);
        const info = await this.request.json(`https://pixeldrain.com/api/file/${id}/info`);
        if (info.success === false || info.can_download === false) {
            throw new Error(info.availability_message || `Pixeldrain file ${id} is not downloadable`);
        }
        const title = info.name || id;
        const ext = title.split(".").pop()?.toLowerCase() || mimeExt(info.mime_type) || "mp4";
        const isAudio = /^audio\//i.test(info.mime_type || "");
        const isVideo = /^video\//i.test(info.mime_type || "");
        const formats = [
            (0, helpers_1.progressiveFormat)(`https://pixeldrain.com/api/file/${id}`, {
                format_id: "http",
                ext,
                filesize: info.size ?? null,
                has_video: isVideo || (!isAudio && !isVideo),
                has_audio: true,
                vcodec: isAudio ? "none" : "unknown",
                acodec: "unknown",
            }),
        ];
        let timestamp = null;
        if (info.date_upload) {
            const ms = Date.parse(info.date_upload);
            if (!Number.isNaN(ms))
                timestamp = Math.floor(ms / 1000);
        }
        return (0, helpers_1.baseInfo)(PixeldrainIE.IE_NAME, url, {
            id: info.id || id,
            title,
            thumbnail: info.thumbnail_href
                ? `https://pixeldrain.com${info.thumbnail_href}`
                : undefined,
            timestamp,
            view_count: info.views ?? null,
            formats,
        });
    }
}
exports.PixeldrainIE = PixeldrainIE;
//# sourceMappingURL=pixeldrain.js.map