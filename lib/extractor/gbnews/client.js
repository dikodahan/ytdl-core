"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HLS_CLIENT_PARAMS = exports.PERCEPTION_DEFAULT_CHANNEL_ID = exports.PERCEPTION_API_FORMAT = exports.PERCEPTION_API_VERSION = exports.PERCEPTION_CLIENT_SECRET = exports.PERCEPTION_CLIENT_ID = exports.PERCEPTION_ORIGIN = exports.GBNEWS_CHANNELS_URL = exports.GBNEWS_LIVE_URL = exports.GBNEWS_ORIGIN = void 0;
exports.normalizeGbnewsChannelId = normalizeGbnewsChannelId;
exports.gbnewsChannelPageUrl = gbnewsChannelPageUrl;
exports.withHlsClientParams = withHlsClientParams;
exports.perceptionCall = perceptionCall;
exports.createPerceptionSession = createPerceptionSession;
exports.fetchPerceptionStreamUrl = fetchPerceptionStreamUrl;
exports.listPerceptionChannels = listPerceptionChannels;
exports.parseGbnewsPlayerConfig = parseGbnewsPlayerConfig;
exports.parseGbnewsChannelsHtml = parseGbnewsChannelsHtml;
exports.discoverGbnewsChannels = discoverGbnewsChannels;
exports.resolveGbnewsChannel = resolveGbnewsChannel;
exports.fetchGbnewsStreamUrl = fetchGbnewsStreamUrl;
exports.extractGbnewsLiveFromPage = extractGbnewsLiveFromPage;
const crypto_1 = require("crypto");
exports.GBNEWS_ORIGIN = "https://www.gbnews.com";
exports.GBNEWS_LIVE_URL = `${exports.GBNEWS_ORIGIN}/watch/live`;
exports.GBNEWS_CHANNELS_URL = exports.GBNEWS_LIVE_URL;
exports.PERCEPTION_ORIGIN = "https://gbnews.perception.tv";
exports.PERCEPTION_CLIENT_ID = "2114590823908139151";
/** Signing secret embedded in perception.min.js (`ve.Rt`). */
exports.PERCEPTION_CLIENT_SECRET = "2409d1da-0384-4a5e-b52c-142fe28eaf41";
exports.PERCEPTION_API_VERSION = "11.10";
exports.PERCEPTION_API_FORMAT = "json";
/** Default channel currently embedded as `player/tv/385` on watch/live. */
exports.PERCEPTION_DEFAULT_CHANNEL_ID = "385";
exports.HLS_CLIENT_PARAMS = "client=hlsjs&version=v1.6.15-Fora2&v=6&initialBandwidthLimit=2097153";
const DEFAULT_CHANNELS = [
    {
        id: exports.PERCEPTION_DEFAULT_CHANNEL_ID,
        slug: "gbn1",
        title: "GBN 1 Live",
        pageUrl: `${exports.GBNEWS_ORIGIN}/watch/live`,
    },
    {
        id: exports.PERCEPTION_DEFAULT_CHANNEL_ID,
        slug: "gbn2",
        title: "GBN 2 Live",
        pageUrl: `${exports.GBNEWS_ORIGIN}/watch/live-2`,
    },
];
const SLUG_ALIASES = {
    gbn1: "gbn1",
    "gbn-1": "gbn1",
    live: "gbn1",
    "1": "gbn1",
    gbn2: "gbn2",
    "gbn-2": "gbn2",
    "live-2": "gbn2",
    "2": "gbn2",
};
function normalizeGbnewsChannelId(raw) {
    const key = raw.trim().toLowerCase();
    return SLUG_ALIASES[key] || key;
}
function gbnewsChannelPageUrl(slugOrId) {
    const slug = normalizeGbnewsChannelId(slugOrId);
    if (slug === "gbn2" || slug === "live-2")
        return `${exports.GBNEWS_ORIGIN}/watch/live-2`;
    return exports.GBNEWS_LIVE_URL;
}
function absUrl(pathOrUrl, base) {
    try {
        return new URL(pathOrUrl, base).toString();
    }
    catch {
        return pathOrUrl;
    }
}
function decodeHtml(s) {
    return s
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}
function md5(s) {
    return (0, crypto_1.createHash)("md5").update(s, "utf8").digest("hex");
}
function perceptionSigningKey() {
    return (exports.PERCEPTION_CLIENT_SECRET +
        exports.PERCEPTION_API_VERSION +
        exports.PERCEPTION_API_FORMAT +
        exports.PERCEPTION_CLIENT_ID);
}
function perceptionApiPrefix() {
    return (`Catherine/api/${exports.PERCEPTION_API_VERSION}/${exports.PERCEPTION_API_FORMAT}/` +
        `${exports.PERCEPTION_CLIENT_ID}/`);
}
/** Append browser-equivalent HLS client query params required for playback. */
function withHlsClientParams(streamUrl) {
    const url = new URL(streamUrl);
    if (!url.searchParams.has("client"))
        url.searchParams.set("client", "hlsjs");
    if (!url.searchParams.has("version"))
        url.searchParams.set("version", "v1.6.15-Fora2");
    if (!url.searchParams.has("v"))
        url.searchParams.set("v", "6");
    if (!url.searchParams.has("initialBandwidthLimit")) {
        url.searchParams.set("initialBandwidthLimit", "2097153");
    }
    return url.toString();
}
async function perceptionCall(request, action, payload) {
    const body = JSON.stringify(payload);
    const path = `client/${action}`;
    const sig = md5(perceptionSigningKey() + path + body);
    const url = `${exports.PERCEPTION_ORIGIN}/${perceptionApiPrefix()}${sig}/${path}`;
    return request.json(url, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Origin: exports.PERCEPTION_ORIGIN,
            Referer: `${exports.PERCEPTION_ORIGIN}/player/tv/${exports.PERCEPTION_DEFAULT_CHANNEL_ID}`,
        },
        body,
    });
}
async function createPerceptionSession(request) {
    const plat = await perceptionCall(request, "getPlatformInformation", {
        locale: "en-GB",
        appVersion: 1,
        deviceWidth: 1,
        deviceHeight: 1,
    });
    if (!plat.key) {
        throw new Error(`gbnews: Perception session failed (${plat.errorDetails?.errorDescription || "no key"})`);
    }
    return {
        sessionId: plat.key,
        segmentDuration: Number(plat.defaultSegmentDuration) || 10000,
        numberOfSegmentsForLive: Number(plat.defaultNumberOfSegmentsForLive) || 3,
    };
}
function playbackFormats(segmentDuration, numberOfSegmentsForLive) {
    return [
        {
            protocol: "HLS",
            audioFormats: ["AAC"],
            container: "TS",
            videoCodecs: ["H264"],
            numberOfSegmentsForLive,
            segmentDuration,
            drmTypes: ["CLEAR_KEY"],
            subtitleFormats: ["WEBVTT"],
        },
    ];
}
/** Resolve a playable Perception HLS URL (includes `mwk` token). */
async function fetchPerceptionStreamUrl(request, channelId) {
    const session = await createPerceptionSession(request);
    const res = await perceptionCall(request, "channels/linear/getUrl", {
        locale: "en-GB",
        sessionId: session.sessionId,
        channelId: Number(channelId) || channelId,
        channelType: "TV",
        playbackType: "LIVE",
        delay: 0,
        secureHttp: true,
        bookmarksImageInfo: [],
        playbackFormats: playbackFormats(session.segmentDuration, session.numberOfSegmentsForLive),
    });
    if (!res.url) {
        throw new Error(`gbnews: Perception getUrl failed for channel ${channelId}` +
            (res.errorDetails?.errorDescription ? ` (${res.errorDetails.errorDescription})` : ""));
    }
    return withHlsClientParams(res.url);
}
async function listPerceptionChannels(request) {
    const session = await createPerceptionSession(request);
    const data = await perceptionCall(request, "channels/list", {
        locale: "en-GB",
        sessionId: session.sessionId,
        type: "TV",
    });
    return (data.channels || []).map((ch, i) => ({
        id: String(ch.id ?? ""),
        title: ch.name || ch.mediumName || ch.shortName || `GB News ${ch.id}`,
        number: ch.number != null ? Number(ch.number) : i + 1,
    }));
}
/** Parse Perception channel id / legacy player attrs from a watch page. */
function parseGbnewsPlayerConfig(html) {
    const perception = html.match(/gbnews\.perception\.tv\/player\/tv\/(?<id>\d+)/i)?.groups?.id || null;
    const thumb = html.match(/https?:\/\/thumbnails\.simplestreamcdn\.com\/gbnews\/channel\/\d+\.jpg[^"'<\s]*/i)?.[0] ||
        html.match(/data-poster=["']([^"']+)["']/i)?.[1] ||
        null;
    const h1 = html.match(/<h1[^>]*>\s*([\s\S]*?)\s*<\/h1>/i)?.[1];
    const title = h1
        ? decodeHtml(h1.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())
        : null;
    return { channelId: perception, thumbnail: thumb, title };
}
/** Discover GBN 1 / GBN 2 entries from the live watch page markup. */
function parseGbnewsChannelsHtml(html, pageUrl = exports.GBNEWS_LIVE_URL) {
    const player = parseGbnewsPlayerConfig(html);
    const defaultId = player.channelId || exports.PERCEPTION_DEFAULT_CHANNEL_ID;
    const defaultThumb = player.thumbnail;
    const bySlug = new Map();
    const linkRe = /href="((?:https?:\/\/(?:www\.)?gbnews\.com)?\/watch\/live(?:-2)?)"[^>]*>\s*([\s\S]*?)\s*<\/a>/gi;
    let m;
    while ((m = linkRe.exec(html))) {
        const href = m[1];
        const label = decodeHtml(m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
        const isGbn2 = /live-2/i.test(href);
        const slug = isGbn2 ? "gbn2" : "gbn1";
        if (bySlug.has(slug))
            continue;
        bySlug.set(slug, {
            id: defaultId,
            slug,
            title: label.includes("GBN") ? label : isGbn2 ? "GBN 2 Live" : "GBN 1 Live",
            pageUrl: absUrl(href, pageUrl).replace(/[?#].*$/, ""),
            thumbnail: defaultThumb,
        });
    }
    for (const ch of DEFAULT_CHANNELS) {
        if (bySlug.has(ch.slug))
            continue;
        bySlug.set(ch.slug, {
            id: ch.id || defaultId,
            slug: ch.slug,
            title: ch.title,
            pageUrl: ch.pageUrl,
            thumbnail: defaultThumb || null,
        });
    }
    return [...bySlug.values()];
}
async function discoverGbnewsChannels(request) {
    const html = await request.text(exports.GBNEWS_LIVE_URL, {
        headers: {
            Accept: "text/html,application/xhtml+xml",
            Referer: `${exports.GBNEWS_ORIGIN}/`,
        },
    });
    let channels = parseGbnewsChannelsHtml(html, exports.GBNEWS_LIVE_URL);
    // Prefer live Perception channel catalog ids when available.
    try {
        const remote = await listPerceptionChannels(request);
        if (remote.length) {
            const primary = remote[0];
            channels = channels.map((ch, i) => ({
                ...ch,
                id: remote[i]?.id || primary.id,
                title: remote[i]?.title || ch.title,
            }));
            // Ensure every Perception channel is represented at least once.
            for (const rem of remote) {
                if (channels.some(c => c.id === rem.id))
                    continue;
                channels.push({
                    id: rem.id,
                    slug: rem.id,
                    title: rem.title,
                    pageUrl: exports.GBNEWS_LIVE_URL,
                    thumbnail: null,
                });
            }
        }
    }
    catch {
        /* keep HTML defaults */
    }
    if (!channels.length)
        throw new Error("gbnews: no channels found on watch/live");
    return channels;
}
async function resolveGbnewsChannel(request, channelRef) {
    const raw = channelRef.trim();
    const channels = await discoverGbnewsChannels(request);
    if (/^\d+$/.test(raw)) {
        const byId = channels.find(c => c.id === raw);
        if (byId)
            return byId;
        return {
            id: raw,
            slug: raw,
            title: `GB News ${raw}`,
            pageUrl: exports.GBNEWS_LIVE_URL,
            thumbnail: null,
        };
    }
    const slug = normalizeGbnewsChannelId(raw);
    const found = channels.find(c => c.slug === slug || c.id === slug);
    if (!found)
        throw new Error(`gbnews: unknown channel ${channelRef}`);
    return found;
}
/** @deprecated Prefer fetchPerceptionStreamUrl — kept as alias for callers. */
async function fetchGbnewsStreamUrl(request, channelId, _key, _playerId) {
    return fetchPerceptionStreamUrl(request, channelId);
}
async function extractGbnewsLiveFromPage(request, pageUrl) {
    const html = await request.text(pageUrl, {
        headers: {
            Accept: "text/html,application/xhtml+xml",
            Referer: `${exports.GBNEWS_ORIGIN}/`,
        },
    });
    const cfg = parseGbnewsPlayerConfig(html);
    const channelId = cfg.channelId || exports.PERCEPTION_DEFAULT_CHANNEL_ID;
    const streamUrl = await fetchPerceptionStreamUrl(request, channelId);
    const isGbn2 = /live-2/i.test(pageUrl);
    return {
        channelId,
        streamUrl,
        title: cfg.title || (isGbn2 ? "GBN 2 Live" : "GBN 1 Live"),
        thumbnail: cfg.thumbnail,
        pageUrl,
    };
}
//# sourceMappingURL=client.js.map