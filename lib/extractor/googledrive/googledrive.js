"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleDriveIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /https?:\/\/(?:(?:docs|drive|drive\.usercontent)\.google\.com\/(?:(?:uc|open|download)\?.*?id=|file\/d\/)|video\.google\.com\/get_player\?.*?docid=)(?<id>[a-zA-Z0-9_-]{28,})/i;
const API_KEY = "AIzaSyDVQw45DwoYh632gvsP5vPDqEKvb-Ywnb8";
function mimeExt(mime) {
    if (!mime)
        return undefined;
    const m = mime.match(/\/([\w+-]+)/);
    if (!m?.[1])
        return undefined;
    const map = {
        "mp4": "mp4",
        "webm": "webm",
        "mpeg": "mp3",
        "mp3": "mp3",
        "x-m4a": "m4a",
        "aac": "aac",
    };
    return map[m[1].toLowerCase()] || m[1].toLowerCase();
}
function parseDuration(raw) {
    if (raw == null)
        return null;
    if (typeof raw === "number")
        return raw;
    const m = String(raw).match(/^([\d.]+)s?$/i);
    if (m)
        return Number(m[1]);
    return null;
}
class GoogleDriveIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "googledrive";
    static IE_DESC = "Google Drive";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — progressive / source download`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const id = (0, helpers_1.matchId)(url, VALID_URL);
        const videoInfo = await this.request.json(`https://content-workspacevideo-pa.googleapis.com/v1/drive/media/${id}/playback`, {
            query: { key: API_KEY },
            headers: { Referer: "https://drive.google.com/" },
        });
        const formats = [];
        const streaming = videoInfo.mediaStreamingData?.formatStreamingData || {};
        for (const list of [streaming.progressiveTranscodes, streaming.adaptiveTranscodes]) {
            for (const fmt of list || []) {
                if (!fmt.url)
                    continue;
                const meta = fmt.transcodeMetadata || {};
                const hasVideo = !!meta.videoCodecString;
                const hasAudio = !!meta.audioCodecString;
                formats.push((0, helpers_1.progressiveFormat)(fmt.url, {
                    format_id: fmt.itag != null ? String(fmt.itag) : "http",
                    ext: mimeExt(meta.mimeType) || "mp4",
                    width: meta.width ?? null,
                    height: meta.height ?? null,
                    fps: meta.videoFps ?? null,
                    filesize: meta.contentLength != null ? Number(meta.contentLength) : null,
                    vcodec: meta.videoCodecString || (hasVideo ? "unknown" : "none"),
                    acodec: meta.audioCodecString || (hasAudio ? "unknown" : "none"),
                    has_video: hasVideo || (!hasVideo && !hasAudio),
                    has_audio: hasAudio || (!hasVideo && !hasAudio),
                }));
            }
        }
        const sourceUrl = new URL("https://drive.usercontent.google.com/download");
        sourceUrl.searchParams.set("id", id);
        sourceUrl.searchParams.set("export", "download");
        sourceUrl.searchParams.set("confirm", "t");
        formats.push((0, helpers_1.progressiveFormat)(sourceUrl.toString(), {
            format_id: "source",
            quality: 1,
        }));
        if (!formats.length) {
            throw new Error(`Google Drive file ${id} has no playable formats`);
        }
        const title = videoInfo.mediaMetadata?.title || id;
        const thumb = videoInfo.thumbnails?.find(t => t.url)?.url;
        return (0, helpers_1.baseInfo)(GoogleDriveIE.IE_NAME, url, {
            id,
            title,
            duration: parseDuration(videoInfo.mediaMetadata?.duration),
            thumbnail: thumb,
            formats,
        });
    }
}
exports.GoogleDriveIE = GoogleDriveIE;
//# sourceMappingURL=googledrive.js.map