"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArchiveOrgIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:www\.)?archive\.org\/(?:details|embed)\/(?<id>[^?#]+)(?:[?].*)?$/i;
const MEDIA_EXTS = new Set([
    "mp4",
    "m4v",
    "webm",
    "ogv",
    "ogg",
    "mp3",
    "m4a",
    "flac",
    "wav",
    "mpg",
    "mpeg",
    "avi",
    "mkv",
    "mov",
    "opus",
]);
function asString(v) {
    if (Array.isArray(v))
        return v.filter(Boolean).join(" ") || null;
    return v || null;
}
function parseDuration(v) {
    if (v == null)
        return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
}
class ArchiveOrgIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "archiveorg";
    static IE_DESC = "Internet Archive (archive.org)";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — progressive / HLS downloads`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const rawId = decodeURIComponent((0, helpers_1.matchId)(url, VALID_URL));
        const slash = rawId.indexOf("/");
        const identifier = slash >= 0 ? rawId.slice(0, slash) : rawId;
        const entryId = slash >= 0 ? rawId.slice(slash + 1) : null;
        const embed = await this.request.text(`https://archive.org/embed/${identifier}`);
        const playAv = embed.match(/<play-av\b([^>]*)>/i)?.[1];
        const playlistAttr = playAv?.match(/\bplaylist=(["'])([\s\S]*?)\1/i)?.[2];
        const playlist = playlistAttr
            ? ((0, helpers_1.tryParseJson)(playlistAttr.replace(/&quot;/g, '"')) || [])
            : [];
        const meta = await this.request.json(`https://archive.org/metadata/${identifier}`);
        const m = meta.metadata || {};
        const itemId = m.identifier || identifier;
        const files = meta.files || [];
        let preferOrig = entryId;
        if (!preferOrig && playlist.length === 1)
            preferOrig = playlist[0]?.orig || null;
        if (!preferOrig && playlist.length > 1) {
            preferOrig =
                playlist.find(p => /\.(mp4|webm|ogv|m4v)$/i.test(p.orig || ""))?.orig ||
                    playlist[0]?.orig ||
                    null;
        }
        const formats = [];
        let title = asString(m.title) || itemId;
        let duration = null;
        let thumbnail;
        let trackTitle = null;
        for (const f of files) {
            if (!f.name)
                continue;
            if (f.format === "Thumbnail" && (!preferOrig || f.original === preferOrig)) {
                thumbnail = `https://archive.org/download/${itemId}/${encodeURIComponent(f.name)}`;
                continue;
            }
            const ext = f.name.includes(".") ? f.name.split(".").pop().toLowerCase() : "";
            if (!MEDIA_EXTS.has(ext))
                continue;
            if (f.private && String(f.private) !== "false")
                continue;
            const belongs = !preferOrig ||
                f.name === preferOrig ||
                f.original === preferOrig ||
                f.name.startsWith(`${preferOrig}.`);
            if (!belongs)
                continue;
            const fileUrl = `https://archive.org/download/${itemId}/${encodeURIComponent(f.name)}`;
            if (ext === "m3u8")
                formats.push((0, helpers_1.hlsFormat)(fileUrl));
            else {
                const isAudio = /^(mp3|m4a|flac|wav|opus|ogg)$/i.test(ext);
                formats.push((0, helpers_1.progressiveFormat)(fileUrl, {
                    format_id: f.format || ext,
                    filesize: f.size != null ? Number(f.size) || null : null,
                    width: f.width != null ? Number(f.width) || null : null,
                    height: f.height != null ? Number(f.height) || null : null,
                    has_video: !isAudio,
                    vcodec: isAudio ? "none" : "unknown",
                    source_preference: f.source === "original" ? 0 : -1,
                }));
            }
            if (f.length != null)
                duration = parseDuration(f.length) ?? duration;
            if (f.title)
                trackTitle = f.title;
        }
        if (!formats.length) {
            throw new Error(`archive.org item ${itemId} has no playable media` +
                (preferOrig ? ` for file ${preferOrig}` : ""));
        }
        if (preferOrig) {
            const pl = playlist.find(p => p.orig === preferOrig);
            if (pl?.title)
                trackTitle = pl.title;
        }
        return (0, helpers_1.baseInfo)("archiveorg", url, {
            id: preferOrig ? `${itemId}/${preferOrig}` : itemId,
            title: trackTitle || title,
            description: asString(m.description),
            uploader: m.uploader || m.adder || null,
            thumbnail,
            duration,
            formats,
        });
    }
}
exports.ArchiveOrgIE = ArchiveOrgIE;
//# sourceMappingURL=archiveorg.js.map