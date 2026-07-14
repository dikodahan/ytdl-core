"use strict";
const stream_1 = require("stream");
const youtube_dl_1 = require("../core/youtube-dl");
const format_select_1 = require("../core/format-select");
const request_1 = require("../networking/request");
const http_1 = require("../downloader/http");
const base_1 = require("../extractor/youtube/base");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require("../../package.json");
function mapClient(name) {
    const map = {
        WEB: "web",
        WEB_EMBEDDED: "web_embedded",
        TV: "tv",
        IOS: "ios",
        ANDROID: "android",
    };
    return map[name] || name.toLowerCase();
}
function toParams(options = {}) {
    return {
        agent: options.agent,
        lang: options.lang,
        headers: options.headers,
        poTokens: options.poTokens,
        playerClients: options.playerClients?.map(mapClient),
    };
}
function enrichFormat(f) {
    const hasAudio = !!(f.has_audio ?? f.hasAudio);
    const hasVideo = !!(f.has_video ?? f.hasVideo);
    const mime = f.mimeType || "";
    const codecsMatch = /codecs="([^"]+)"/.exec(mime);
    const codecs = codecsMatch?.[1] || [f.vcodec, f.acodec].filter(c => c && c !== "none").join(", ");
    return {
        ...f,
        hasAudio,
        hasVideo,
        has_audio: hasAudio,
        has_video: hasVideo,
        isLive: !!f.is_live,
        container: f.ext,
        codecs,
        videoCodec: f.vcodec && f.vcodec !== "none" ? String(f.vcodec) : undefined,
        audioCodec: f.acodec && f.acodec !== "none" ? String(f.acodec) : undefined,
        itag: f.itag ?? (Number(f.format_id) || 0),
        url: f.url || f.manifest_url || "",
        lastModified: f.lastModified || "",
        contentLength: f.contentLength || (f.filesize != null ? String(f.filesize) : ""),
        qualityLabel: f.qualityLabel || undefined,
    };
}
function infoDictToVideoInfo(info, full) {
    const pr = info._player_responses?.[0] ||
        {};
    const formats = (info.formats || []).map(enrichFormat);
    const details = {
        videoId: info.id,
        title: info.title || info.id,
        lengthSeconds: String(info.duration || 0),
        channelId: info.channel_id || undefined,
        shortDescription: info.description || undefined,
        viewCount: info.view_count != null ? String(info.view_count) : undefined,
        author: info.channel || info.uploader || undefined,
        isLiveContent: !!info.was_live || !!info.is_live,
        isLive: !!info.is_live,
        likes: info.like_count ?? null,
        age_restricted: (info.age_limit || 0) >= 18,
        video_url: info.webpage_url,
        thumbnail: {
            thumbnails: (info.thumbnails || []).map(t => ({
                url: t.url,
                width: t.width,
                height: t.height,
            })),
        },
    };
    const best = formats.find(f => f.hasVideo && f.hasAudio) ||
        formats.find(f => f.hasVideo) ||
        formats.find(f => f.hasAudio) ||
        formats[0];
    return {
        full,
        page: ["watch"],
        player_response: pr,
        html5player: info._player_url || null,
        formats,
        related_videos: [],
        videoDetails: details,
        video_url: info.webpage_url,
        videoUrl: best?.url,
        bestFormat: best,
        selectedFormat: best,
    };
}
const infoCache = new Map();
const watchCache = new Map();
const CACHE_TTL = 60_000;
function cacheGetOrSet(map, key, fn) {
    const hit = map.get(key);
    if (hit && hit.expires > Date.now())
        return hit.value;
    const value = fn();
    map.set(key, { value, expires: Date.now() + CACHE_TTL });
    value.catch(() => map.delete(key));
    return value;
}
async function getInfoInternal(link, options = {}, full) {
    const id = (0, base_1.getVideoID)(link);
    const key = `${id}:${full}:${JSON.stringify(options.playerClients || [])}`;
    return cacheGetOrSet(infoCache, key, async () => {
        const ydl = new youtube_dl_1.YoutubeDL(toParams(options));
        const info = await ydl.extractInfo(id);
        return infoDictToVideoInfo(info, full);
    });
}
async function getBasicInfo(link, options) {
    const info = await getInfoInternal(link, options, false);
    // basic info historically skipped deciphered adaptive URLs; we still return formats from jsless clients
    return info;
}
async function getInfo(link, options) {
    return getInfoInternal(link, options, true);
}
function chooseFormat(formats, options) {
    const list = Array.isArray(formats) ? formats : [formats];
    return (0, format_select_1.chooseFormat)(list, options || {});
}
function filterFormats(formats, filter) {
    if (typeof filter === "function") {
        return formats.filter(filter);
    }
    return (0, format_select_1.filterFormats)(formats, filter);
}
function downloadFromInfoCallback(stream, info, options = {}) {
    if (!info.formats?.length) {
        stream.emit("error", new Error("This video is unavailable"));
        return;
    }
    let format;
    try {
        format = chooseFormat(info.formats, options);
    }
    catch (e) {
        stream.emit("error", e);
        return;
    }
    stream.emit("info", info, format);
    if (stream.destroyed)
        return;
    const media = (0, http_1.downloadFormat)(format, toParams(options), {
        range: options.range,
        begin: options.begin,
        liveBuffer: options.liveBuffer,
        highWaterMark: options.highWaterMark,
        dlChunkSize: options.dlChunkSize,
    });
    media.on("error", err => stream.emit("error", err));
    media.on("progress", (...args) => stream.emit("progress", ...args));
    media.pipe(stream);
}
function downloadFromInfo(info, options) {
    const stream = new stream_1.PassThrough({ highWaterMark: options?.highWaterMark || 1024 * 512 });
    if (!info.full) {
        throw new Error("Cannot use `ytdl.downloadFromInfo()` when called with info from `ytdl.getBasicInfo()`");
    }
    setImmediate(() => downloadFromInfoCallback(stream, info, options));
    return stream;
}
function ytdl(link, options) {
    const stream = new stream_1.PassThrough({ highWaterMark: options?.highWaterMark || 1024 * 512 });
    getInfo(link, options).then(info => downloadFromInfoCallback(stream, info, options), err => stream.emit("error", err));
    return stream;
}
ytdl.getBasicInfo = getBasicInfo;
ytdl.getInfo = getInfo;
ytdl.downloadFromInfo = downloadFromInfo;
ytdl.chooseFormat = chooseFormat;
ytdl.filterFormats = filterFormats;
ytdl.validateID = base_1.validateID;
ytdl.validateURL = base_1.validateURL;
ytdl.getURLVideoID = base_1.getURLVideoID;
ytdl.getVideoID = base_1.getVideoID;
ytdl.createAgent = request_1.createAgent;
ytdl.createProxyAgent = request_1.createProxyAgent;
ytdl.cache = {
    info: infoCache,
    watch: watchCache,
};
ytdl.version = pkg.version;
module.exports = ytdl;
//# sourceMappingURL=ytdl-core.js.map