"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchId = matchId;
exports.hlsFormat = hlsFormat;
exports.dashFormat = dashFormat;
exports.progressiveFormat = progressiveFormat;
exports.baseInfo = baseInfo;
exports.extractBetween = extractBetween;
exports.tryParseJson = tryParseJson;
exports.extractJsonObject = extractJsonObject;
exports.searchJsonAssignment = searchJsonAssignment;
function matchId(url, re, group = "id") {
    const m = url.match(re);
    if (!m)
        throw new Error(`Could not extract id from URL: ${url}`);
    if (typeof group === "number") {
        const id = m[group];
        if (!id)
            throw new Error(`Could not extract id from URL: ${url}`);
        return id;
    }
    const id = (m.groups && m.groups[group]) || m[1];
    if (!id)
        throw new Error(`Could not extract id from URL: ${url}`);
    return id;
}
function hlsFormat(url, formatId = "hls") {
    return {
        format_id: formatId,
        url,
        manifest_url: url,
        ext: "mp4",
        protocol: "m3u8_native",
        isHLS: true,
        has_video: true,
        has_audio: true,
        vcodec: "unknown",
        acodec: "unknown",
    };
}
function dashFormat(url, formatId = "dash") {
    return {
        format_id: formatId,
        url,
        manifest_url: url,
        ext: "mp4",
        protocol: "http_dash_segments",
        isDashMPD: true,
        has_video: true,
        has_audio: true,
        vcodec: "unknown",
        acodec: "unknown",
    };
}
function progressiveFormat(url, opts = {}) {
    const ext = opts.ext || guessExt(url) || "mp4";
    return {
        format_id: opts.format_id || "http",
        url,
        ext,
        protocol: "https",
        has_video: opts.has_video ?? !/audio|mp3|aac|m4a/i.test(ext),
        has_audio: opts.has_audio ?? true,
        vcodec: opts.vcodec ?? (opts.has_video === false ? "none" : "unknown"),
        acodec: opts.acodec ?? "unknown",
        width: opts.width ?? null,
        height: opts.height ?? null,
        tbr: opts.tbr ?? null,
        filesize: opts.filesize ?? null,
        ...opts,
    };
}
function guessExt(url) {
    const path = url.split("?")[0] || "";
    const m = path.match(/\.([a-z0-9]{2,5})$/i);
    return m?.[1]?.toLowerCase();
}
function baseInfo(extractor, url, fields) {
    return {
        ...fields,
        extractor,
        extractor_key: extractor,
        webpage_url: url,
        original_url: url,
    };
}
function extractBetween(html, left, right) {
    const i = html.indexOf(left);
    if (i < 0)
        return null;
    const start = i + left.length;
    const j = html.indexOf(right, start);
    if (j < 0)
        return null;
    return html.slice(start, j);
}
function tryParseJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
/** Find first balanced `{...}` JSON object starting at `from` index of `{`. */
function extractJsonObject(html, from) {
    if (html[from] !== "{")
        return null;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = from; i < html.length; i++) {
        const ch = html[i];
        if (inStr) {
            if (esc)
                esc = false;
            else if (ch === "\\")
                esc = true;
            else if (ch === '"')
                inStr = false;
            continue;
        }
        if (ch === '"') {
            inStr = true;
            continue;
        }
        if (ch === "{")
            depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) {
                return tryParseJson(html.slice(from, i + 1));
            }
        }
    }
    return null;
}
function searchJsonAssignment(html, assignRe) {
    const m = html.match(assignRe);
    if (!m || m.index == null)
        return null;
    const brace = html.indexOf("{", m.index + m[0].length - 1);
    if (brace < 0)
        return null;
    return extractJsonObject(html, brace);
}
//# sourceMappingURL=helpers.js.map