"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XiaoHongShuIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/www\.xiaohongshu\.com\/(?:explore|discovery\/item)\/(?<id>[\da-f]+)/i;
function jsToJsonSafe(raw) {
    const cleaned = raw
        .replace(/\bundefined\b/g, "null")
        .replace(/\bNaN\b/g, "null")
        .replace(/,\s*([}\]])/g, "$1");
    return (0, helpers_1.tryParseJson)(cleaned);
}
function flattenStreams(streamRoot) {
    if (!streamRoot || typeof streamRoot !== "object")
        return [];
    const out = [];
    if (Array.isArray(streamRoot)) {
        for (const item of streamRoot) {
            if (Array.isArray(item))
                out.push(...item);
            else if (item && typeof item === "object")
                out.push(item);
        }
        return out;
    }
    for (const value of Object.values(streamRoot)) {
        if (Array.isArray(value)) {
            for (const item of value) {
                if (Array.isArray(item))
                    out.push(...item);
                else if (item && typeof item === "object")
                    out.push(item);
            }
        }
    }
    return out;
}
class XiaoHongShuIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "xiaohongshu";
    static IE_DESC = "小红书 / Xiaohongshu (RED)";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — window.__INITIAL_STATE__ video streams`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const displayId = (0, helpers_1.matchId)(url, VALID_URL);
        const webpage = await this.request.text(url);
        const assign = webpage.match(/window\.__INITIAL_STATE__\s*=/);
        if (!assign || assign.index == null) {
            throw new Error("xiaohongshu: __INITIAL_STATE__ not found (login / challenge may be required)");
        }
        const brace = webpage.indexOf("{", assign.index + assign[0].length - 1);
        const rawObj = (0, helpers_1.extractJsonObject)(webpage, brace);
        let state = rawObj && typeof rawObj === "object" ? rawObj : null;
        if (!state) {
            // JS-ish state: take a large slice and sanitize
            const slice = webpage.slice(brace, brace + 500_000);
            const end = slice.lastIndexOf("}</script>");
            const candidate = end > 0 ? slice.slice(0, end + 1) : slice;
            state = jsToJsonSafe(candidate);
        }
        if (!state)
            throw new Error("xiaohongshu: failed to parse __INITIAL_STATE__");
        const noteMap = state.note?.noteDetailMap || {};
        const noteInfo = noteMap[displayId]?.note;
        if (!noteInfo) {
            throw new Error(`xiaohongshu: note ${displayId} missing from initial state (login may be required)`);
        }
        const formats = [];
        const streams = flattenStreams(noteInfo.video?.media?.stream);
        for (const info of streams) {
            const urls = [info.masterUrl, ...(info.backupUrls || [])].filter((u) => typeof u === "string" && /^https?:\/\//i.test(u));
            for (const streamUrl of urls) {
                const formatId = info.qualityType || "http";
                const common = {
                    width: info.width ?? null,
                    height: info.height ?? null,
                    tbr: info.avgBitrate != null ? Math.round(info.avgBitrate / 1000) : null,
                    filesize: info.size ?? null,
                    vcodec: info.videoCodec || "unknown",
                    acodec: info.audioCodec || "unknown",
                };
                if (/\.m3u8/i.test(streamUrl)) {
                    formats.push({ ...(0, helpers_1.hlsFormat)(streamUrl, formatId), ...common });
                }
                else {
                    formats.push((0, helpers_1.progressiveFormat)(streamUrl, { format_id: formatId, ...common }));
                }
            }
        }
        const originKey = noteInfo.video?.consumer?.originVideoKey;
        if (originKey) {
            const originUrl = `https://sns-video-bd.xhscdn.com/${originKey}`;
            try {
                const head = await this.request.request(originUrl, { method: "GET" });
                if (head.statusCode < 400) {
                    formats.push((0, helpers_1.progressiveFormat)(originUrl, { format_id: "direct" }));
                }
            }
            catch {
                /* original optional */
            }
        }
        if (!formats.length) {
            throw new Error(`xiaohongshu: no video stream urls for ${displayId}`);
        }
        const thumb = noteInfo.imageList?.[0]?.urlDefault ||
            noteInfo.imageList?.[0]?.urlPre ||
            webpage.match(/property=["']og:image["']\s+content=["']([^"']+)/i)?.[1];
        const title = noteInfo.title ||
            webpage.match(/property=["']og:title["']\s+content=["']([^"']+)/i)?.[1] ||
            displayId;
        return (0, helpers_1.baseInfo)("xiaohongshu", url, {
            id: displayId,
            title,
            description: noteInfo.desc || null,
            uploader: noteInfo.user?.nickname || null,
            uploader_id: noteInfo.user?.userId || null,
            thumbnail: thumb,
            duration: streams[0]?.duration != null ? streams[0].duration / 1000 : null,
            formats,
        });
    }
}
exports.XiaoHongShuIE = XiaoHongShuIE;
//# sourceMappingURL=xiaohongshu.js.map