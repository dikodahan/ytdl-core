"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.idRegex = exports.YT_BASE = void 0;
exports.validateID = validateID;
exports.getURLVideoID = getURLVideoID;
exports.getVideoID = getVideoID;
exports.validateURL = validateURL;
exports.between = between;
exports.parseYtInitialPlayerResponse = parseYtInitialPlayerResponse;
exports.extractYtcfg = extractYtcfg;
exports.extractPlayerJsUrl = extractPlayerJsUrl;
exports.extractSignatureTimestamp = extractSignatureTimestamp;
exports.extractVisitorData = extractVisitorData;
exports.playabilityError = playabilityError;
exports.callPlayerApi = callPlayerApi;
exports.generateClientPlaybackNonce = generateClientPlaybackNonce;
const clients_1 = require("./clients");
exports.YT_BASE = "https://www.youtube.com";
exports.idRegex = /^[a-zA-Z0-9_-]{11}$/;
const validQueryDomains = new Set([
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "gaming.youtube.com",
]);
const validPathDomains = /^https?:\/\/(youtu\.be\/|(www\.)?youtube\.com\/(embed|v|shorts|live)\/)/;
function validateID(id) {
    return exports.idRegex.test(id.trim());
}
function getURLVideoID(link) {
    const parsed = new URL(link.trim());
    let id = parsed.searchParams.get("v");
    if (validPathDomains.test(link.trim()) && !id) {
        const paths = parsed.pathname.split("/");
        id = parsed.host === "youtu.be" ? paths[1] : paths[2];
    }
    else if (parsed.hostname && !validQueryDomains.has(parsed.hostname)) {
        throw new Error("Not a YouTube domain");
    }
    if (!id)
        throw new Error(`No video id found: "${link}"`);
    id = id.substring(0, 11);
    if (!validateID(id)) {
        throw new TypeError(`Video id (${id}) does not match expected format`);
    }
    return id;
}
function getVideoID(str) {
    if (validateID(str))
        return str.trim();
    if (/^https?:\/\//.test(str.trim()))
        return getURLVideoID(str);
    throw new Error(`No video id found: ${str}`);
}
function validateURL(string) {
    try {
        getURLVideoID(string);
        return true;
    }
    catch {
        return false;
    }
}
function between(haystack, left, right) {
    let pos;
    if (left instanceof RegExp) {
        const m = left.exec(haystack);
        if (!m)
            return "";
        pos = m.index + m[0].length;
    }
    else {
        pos = haystack.indexOf(left);
        if (pos === -1)
            return "";
        pos += left.length;
    }
    const end = haystack.indexOf(right, pos);
    if (end === -1)
        return "";
    return haystack.slice(pos, end);
}
function parseYtInitialPlayerResponse(body) {
    const patterns = [
        /ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var\s+(?:meta|head)|<\/script|\n)/s,
        /ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s,
    ];
    for (const re of patterns) {
        const m = re.exec(body);
        if (m?.[1]) {
            try {
                return JSON.parse(m[1]);
            }
            catch {
                /* try next */
            }
        }
    }
    const raw = between(body, "ytInitialPlayerResponse = ", ";var meta");
    if (raw) {
        try {
            return JSON.parse(raw);
        }
        catch {
            /* ignore */
        }
    }
    return null;
}
function extractYtcfg(body) {
    const m = /ytcfg\.set\s*\(\s*(\{.+?\})\s*\)\s*;/.exec(body);
    if (!m?.[1])
        return null;
    try {
        return JSON.parse(m[1]);
    }
    catch {
        return null;
    }
}
function extractPlayerJsUrl(body) {
    const m = /<script\s+src="([^"]+)"(?:\s+type="text\/javascript")?\s+name="player_ias\/base"\s*>|"jsUrl":"([^"]+)"/.exec(body);
    const url = m?.[1] || m?.[2];
    if (!url)
        return null;
    return new URL(url, exports.YT_BASE).toString();
}
function extractSignatureTimestamp(playerJs) {
    const m = /(signatureTimestamp|sts)\s*:\s*(\d+)/.exec(playerJs);
    return m?.[2] || null;
}
function extractVisitorData(...sources) {
    for (const src of sources) {
        if (!src)
            continue;
        try {
            const ctx = src.responseContext;
            if (ctx?.visitorData)
                return ctx.visitorData;
            const gfeedback = ctx?.serviceTrackingParams?.find(x => x.service === "GFEEDBACK");
            const vd = gfeedback?.params?.find(x => x.key === "visitor_data")?.value;
            if (vd)
                return vd;
        }
        catch {
            /* continue */
        }
        const ytcfg = src;
        if (ytcfg.VISITOR_DATA)
            return ytcfg.VISITOR_DATA;
        if (ytcfg.INNERTUBE_CONTEXT?.client?.visitorData)
            return ytcfg.INNERTUBE_CONTEXT.client.visitorData;
    }
    return null;
}
function playabilityError(playerResponse) {
    if (!playerResponse)
        return null;
    const status = playerResponse.playabilityStatus?.status;
    if (!status || status === "OK" || status === "LIVE_STREAM_OFFLINE")
        return null;
    const reason = playerResponse.playabilityStatus?.reason ||
        `Playback status: ${status}`;
    return new Error(reason);
}
async function callPlayerApi(request, videoId, client, opts = {}) {
    const cfg = (0, clients_1.getClientConfig)(client);
    const ua = cfg.INNERTUBE_CONTEXT.client.userAgent;
    const context = structuredClone(cfg.INNERTUBE_CONTEXT);
    if (opts.visitorData) {
        context.client.visitorData = opts.visitorData;
    }
    const query = {
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
    };
    if (opts.poToken) {
        query.serviceIntegrityDimensions = { poToken: opts.poToken };
    }
    const sts = opts.signatureTimestamp;
    query.playbackContext = opts.playbackContext || {
        contentPlaybackContext: {
            html5Preference: "HTML5_PREF_WANTS",
            ...(sts ? { signatureTimestamp: Number(sts) } : {}),
        },
    };
    const host = cfg.INNERTUBE_HOST || "www.youtube.com";
    const headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Format-Version": "2",
        "X-YouTube-Client-Name": String(cfg.INNERTUBE_CONTEXT_CLIENT_NAME),
        "X-YouTube-Client-Version": String(cfg.INNERTUBE_CONTEXT.client.clientVersion),
    };
    if (ua)
        headers["User-Agent"] = ua;
    if (opts.visitorData)
        headers["X-Goog-Visitor-Id"] = opts.visitorData;
    const payload = { context, ...query };
    return request.json(`https://${host}/youtubei/v1/player`, {
        method: "POST",
        headers,
        query: { prettyPrint: "false" },
        body: JSON.stringify(payload),
    });
}
function generateClientPlaybackNonce(length = 16) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let out = "";
    for (let i = 0; i < length; i++) {
        out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
}
//# sourceMappingURL=base.js.map