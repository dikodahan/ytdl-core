"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAmpFeed = parseAmpFeed;
const helpers_1 = require("./helpers");
function stripJsonp(text) {
    const trimmed = text.trim();
    const open = trimmed.indexOf("(");
    const close = trimmed.lastIndexOf(")");
    if (open >= 0 && close > open)
        return trimmed.slice(open + 1, close);
    return trimmed;
}
function asArray(value) {
    if (!value)
        return [];
    return Array.isArray(value) ? value : [value];
}
function getMediaNode(item, name) {
    const mediaName = `media-${name}`;
    const group = item["media-group"];
    const mediaGroup = group && typeof group === "object" && !Array.isArray(group)
        ? group
        : null;
    return (mediaGroup?.[mediaName] ??
        item[mediaName] ??
        item[name] ??
        null);
}
function parseTimestamp(pubDate, isoDate) {
    if (isoDate) {
        const t = Date.parse(isoDate);
        if (Number.isFinite(t))
            return Math.floor(t / 1000);
    }
    if (pubDate) {
        const t = Date.parse(pubDate);
        if (Number.isFinite(t))
            return Math.floor(t / 1000);
    }
    return null;
}
function extFromType(type, url) {
    if (type?.includes("mpegURL") || type?.includes("m3u8"))
        return "m3u8";
    if (type?.includes("mp4"))
        return "mp4";
    if (url?.includes(".m3u8"))
        return "m3u8";
    const m = url?.split("?")[0]?.match(/\.([a-z0-9]{2,5})$/i);
    return m?.[1]?.toLowerCase() || "mp4";
}
/** Parse Akamai Adaptive Media Player JSONP feed (yt-dlp AMPIE). */
function parseAmpFeed(raw, videoId) {
    const feed = (0, helpers_1.tryParseJson)(stripJsonp(raw));
    const item = feed?.channel?.item;
    if (!item) {
        throw new Error(`foxnews: ${feed?.error || "Akamai AMP feed missing channel.item"}`);
    }
    const id = String(item.guid || videoId);
    const title = String(getMediaNode(item, "title") || item.title || id);
    const description = String(getMediaNode(item, "description") || item.description || "") || null;
    let thumbnail = null;
    for (const thumb of asArray(getMediaNode(item, "thumbnail"))) {
        const url = thumb["@attributes"]?.url;
        if (url) {
            thumbnail = url.startsWith("//") ? `https:${url}` : url;
            break;
        }
    }
    const formats = [];
    let duration = null;
    for (const mediaData of asArray(getMediaNode(item, "content"))) {
        const media = mediaData["@attributes"] || {};
        const mediaUrl = media.url;
        if (!mediaUrl)
            continue;
        const label = mediaData["media-category"]?.["@attributes"]?.label ||
            media.type ||
            "http";
        const dur = media.duration ? Number(media.duration) : null;
        if (dur && Number.isFinite(dur))
            duration = dur;
        const ext = extFromType(media.type, mediaUrl);
        const url = mediaUrl.startsWith("//") ? `https:${mediaUrl}` : mediaUrl;
        if (ext === "m3u8") {
            formats.push((0, helpers_1.hlsFormat)(url, String(label).toLowerCase().replace(/\W+/g, "_") || "hls"));
        }
        else if (ext === "f4m") {
            // Flash/HDS — skip (VLC-oriented path prefers HLS/MP4)
            continue;
        }
        else {
            formats.push((0, helpers_1.progressiveFormat)(url, {
                format_id: String(label),
                tbr: media.bitrate ? Number(media.bitrate) : null,
                filesize: media.fileSize ? Number(media.fileSize) : null,
                ext,
            }));
        }
    }
    if (!formats.length) {
        throw new Error(`foxnews: no playable formats in AMP feed for ${id}`);
    }
    return {
        id,
        title,
        description,
        thumbnail,
        duration,
        timestamp: parseTimestamp(item.pubDate, item["dc-date"]),
        formats,
    };
}
//# sourceMappingURL=amp-feed.js.map