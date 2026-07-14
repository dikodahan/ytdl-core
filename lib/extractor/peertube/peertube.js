"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeertubeIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const UUID_RE = "[\\da-zA-Z]{22}|[\\da-fA-F]{8}-[\\da-fA-F]{4}-[\\da-fA-F]{4}-[\\da-fA-F]{4}-[\\da-fA-F]{12}";
const VALID_URL = new RegExp(`^(?:peertube:(?<host>[^:]+):|https?:\\/\\/(?<host_2>[^/]+)\\/(?:videos\\/(?:watch|embed)|api\\/v\\d+\\/videos|w)\\/)(?<id>${UUID_RE})`, "i");
function parseHeight(label) {
    if (!label)
        return null;
    const m = label.match(/(\d+)/);
    return m ? Number(m[1]) : null;
}
class PeertubeIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "peertube";
    static IE_DESC = "PeerTube";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — progressive + HLS playlists`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const m = url.match(VALID_URL);
        if (!m?.groups?.id)
            throw new Error(`Could not extract id from URL: ${url}`);
        const host = m.groups.host || m.groups.host_2;
        const videoId = m.groups.id;
        if (!host)
            throw new Error(`Could not extract PeerTube host from URL: ${url}`);
        const video = await this.request.json(`https://${host}/api/v1/videos/${videoId}`);
        const formats = [];
        const files = [...(video.files || [])];
        for (const playlist of video.streamingPlaylists || []) {
            if (playlist.playlistUrl) {
                formats.push((0, helpers_1.hlsFormat)(playlist.playlistUrl, "hls"));
            }
            if (Array.isArray(playlist.files))
                files.push(...playlist.files);
        }
        for (const file of files) {
            if (!file.fileUrl)
                continue;
            const formatId = file.resolution?.label || "http";
            formats.push((0, helpers_1.progressiveFormat)(file.fileUrl, {
                format_id: formatId,
                filesize: file.size ?? null,
                height: parseHeight(formatId),
                has_video: formatId !== "0p",
                vcodec: formatId === "0p" ? "none" : "unknown",
            }));
        }
        if (!formats.length)
            throw new Error(`No playable formats for PeerTube ${videoId}`);
        const webpageUrl = `https://${host}/videos/watch/${videoId}`;
        const thumbPath = video.thumbnailPath;
        const thumbnail = thumbPath
            ? thumbPath.startsWith("http")
                ? thumbPath
                : new URL(thumbPath, webpageUrl).toString()
            : undefined;
        return (0, helpers_1.baseInfo)("peertube", url, {
            id: videoId,
            title: video.name || videoId,
            description: video.description || null,
            uploader: video.account?.displayName || null,
            uploader_id: video.account?.id != null ? String(video.account.id) : null,
            duration: video.duration ?? null,
            thumbnail,
            formats,
        });
    }
}
exports.PeertubeIE = PeertubeIE;
//# sourceMappingURL=peertube.js.map