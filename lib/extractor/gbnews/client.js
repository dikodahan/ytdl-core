"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SS_STREAMS_HOST_FALLBACK = exports.SS_PLAYER_API = exports.GBNEWS_DEFAULT_PLAYER_ID = exports.GBNEWS_DEFAULT_KEY = exports.GBNEWS_CHANNELS_URL = exports.GBNEWS_LIVE_URL = exports.GBNEWS_ORIGIN = void 0;
exports.normalizeGbnewsChannelId = normalizeGbnewsChannelId;
exports.gbnewsChannelPageUrl = gbnewsChannelPageUrl;
exports.parseGbnewsPlayerConfig = parseGbnewsPlayerConfig;
exports.parseGbnewsChannelsHtml = parseGbnewsChannelsHtml;
exports.discoverGbnewsChannels = discoverGbnewsChannels;
exports.fetchGbnewsPlayerSettings = fetchGbnewsPlayerSettings;
exports.fetchGbnewsStreamUrl = fetchGbnewsStreamUrl;
exports.resolveGbnewsChannel = resolveGbnewsChannel;
exports.extractGbnewsLiveFromPage = extractGbnewsLiveFromPage;
exports.GBNEWS_ORIGIN = "https://www.gbnews.com";
exports.GBNEWS_LIVE_URL = `${exports.GBNEWS_ORIGIN}/watch/live`;
exports.GBNEWS_CHANNELS_URL = exports.GBNEWS_LIVE_URL;
/** Default Simplestream player credentials embedded on gbnews.com watch pages. */
exports.GBNEWS_DEFAULT_KEY = "3Li3Nt2Qs8Ct3Xq9Fi5Uy0Mb2Bj0Qs";
exports.GBNEWS_DEFAULT_PLAYER_ID = "GB005";
exports.SS_PLAYER_API = "https://mm-v2.simplestream.com/ssmp/api.php";
exports.SS_STREAMS_HOST_FALLBACK = "https://v2-streams-elb.simplestreamcdn.com";
const DEFAULT_CHANNELS = [
    {
        id: "gbn1",
        slug: "gbn1",
        title: "GBN 1 Live",
        pageUrl: `${exports.GBNEWS_ORIGIN}/watch/live`,
        uvid: "1069",
    },
    {
        id: "gbn2",
        slug: "gbn2",
        title: "GBN 2 Live",
        pageUrl: `${exports.GBNEWS_ORIGIN}/watch/live-2`,
        uvid: "1069",
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
    if (/^\d+$/.test(slug))
        return exports.GBNEWS_LIVE_URL;
    return `${exports.GBNEWS_ORIGIN}/watch/live`;
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
/** Parse Simplestream player attributes from a watch page. */
function parseGbnewsPlayerConfig(html) {
    const attr = (name) => {
        const re = new RegExp(`data-${name}=["']([^"']+)["']`, "i");
        return html.match(re)?.[1] || null;
    };
    let uvid = attr("uvid");
    let playerId = attr("id");
    let key = attr("key");
    let thumbnail = attr("poster");
    let title = attr("title");
    // Fallback: schema.org VideoObject embed / contentUrl
    const playerQs = html.match(/mm-v2\.simplestream\.com\/iframe\/player\.php\?([^"'<\s]+)/i)?.[1] || null;
    if (playerQs) {
        const params = new URLSearchParams(playerQs);
        uvid = uvid || params.get("uvid");
        playerId = playerId || params.get("player");
        key = key || params.get("key");
    }
    // Thumbnail from simplestream CDN path
    if (!thumbnail) {
        const thumb = html.match(/https?:\/\/thumbnails\.simplestreamcdn\.com\/gbnews\/channel\/\d+\.jpg[^"'<\s]*/i)?.[0];
        thumbnail = thumb || null;
    }
    if (!title) {
        const h1 = html.match(/<h1[^>]*>\s*([\s\S]*?)\s*<\/h1>/i)?.[1];
        if (h1)
            title = decodeHtml(h1.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
    }
    return {
        uvid: uvid || null,
        playerId: playerId || null,
        key: key || null,
        thumbnail,
        title,
    };
}
/** Discover GBN 1 / GBN 2 entries from the live watch page markup. */
function parseGbnewsChannelsHtml(html, pageUrl = exports.GBNEWS_LIVE_URL) {
    const player = parseGbnewsPlayerConfig(html);
    const defaultUvid = player.uvid || "1069";
    const defaultKey = player.key || exports.GBNEWS_DEFAULT_KEY;
    const defaultPlayer = player.playerId || exports.GBNEWS_DEFAULT_PLAYER_ID;
    const defaultThumb = player.thumbnail ||
        `https://thumbnails.simplestreamcdn.com/gbnews/channel/${defaultUvid}.jpg?width=700&lang=en`;
    const bySlug = new Map();
    // Toggle / hidden links on the live player chrome
    const linkRe = /href="((?:https?:\/\/(?:www\.)?gbnews\.com)?\/watch\/live(?:-2)?)"[^>]*(?:id="(?<id>[^"]+)")?[^>]*>\s*([\s\S]*?)\s*<\/a>/gi;
    let m;
    while ((m = linkRe.exec(html))) {
        const href = m[1];
        const label = decodeHtml(m[3].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
        const isGbn2 = /live-2/i.test(href);
        const slug = isGbn2 ? "gbn2" : "gbn1";
        if (bySlug.has(slug))
            continue;
        const page = absUrl(href, pageUrl).replace(/\?.*$/, "").replace(/#.*$/, "");
        bySlug.set(slug, {
            id: slug,
            slug,
            title: label.includes("GBN") ? label : isGbn2 ? "GBN 2 Live" : "GBN 1 Live",
            pageUrl: page,
            uvid: defaultUvid,
            playerId: defaultPlayer,
            key: defaultKey,
            thumbnail: defaultThumb,
        });
    }
    // Always ensure both defaults exist
    for (const ch of DEFAULT_CHANNELS) {
        if (bySlug.has(ch.slug))
            continue;
        bySlug.set(ch.slug, {
            id: ch.slug,
            slug: ch.slug,
            title: ch.title,
            pageUrl: ch.pageUrl,
            uvid: ch.uvid || defaultUvid,
            playerId: defaultPlayer,
            key: defaultKey,
            thumbnail: defaultThumb,
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
    const channels = parseGbnewsChannelsHtml(html, exports.GBNEWS_LIVE_URL);
    // Prefer live-2 page player config when present (may diverge later).
    try {
        const live2 = await request.text(`${exports.GBNEWS_ORIGIN}/watch/live-2`, {
            headers: {
                Accept: "text/html,application/xhtml+xml",
                Referer: exports.GBNEWS_LIVE_URL,
            },
        });
        const cfg = parseGbnewsPlayerConfig(live2);
        if (cfg.uvid) {
            const gbn2 = channels.find(c => c.slug === "gbn2");
            if (gbn2) {
                gbn2.uvid = cfg.uvid;
                if (cfg.key)
                    gbn2.key = cfg.key;
                if (cfg.playerId)
                    gbn2.playerId = cfg.playerId;
                if (cfg.thumbnail)
                    gbn2.thumbnail = cfg.thumbnail;
                if (cfg.title)
                    gbn2.title = cfg.title;
            }
        }
    }
    catch {
        /* keep defaults */
    }
    if (!channels.length)
        throw new Error("gbnews: no channels found on watch/live");
    return channels;
}
async function fetchGbnewsPlayerSettings(request, playerId = exports.GBNEWS_DEFAULT_PLAYER_ID) {
    const url = `${exports.SS_PLAYER_API}?id=${encodeURIComponent(playerId)}&env=production`;
    const data = await request.json(url, {
        headers: {
            Accept: "application/json",
            Referer: `${exports.GBNEWS_ORIGIN}/`,
            Origin: exports.GBNEWS_ORIGIN,
        },
    });
    if (!data.response || typeof data.response !== "object") {
        throw new Error(`gbnews: player settings unavailable for ${playerId}`);
    }
    return data.response;
}
async function fetchGbnewsStreamUrl(request, uvid, key = exports.GBNEWS_DEFAULT_KEY, playerId = exports.GBNEWS_DEFAULT_PLAYER_ID) {
    let apiHost = exports.SS_STREAMS_HOST_FALLBACK;
    try {
        const settings = await fetchGbnewsPlayerSettings(request, playerId);
        if (settings.api_hostname)
            apiHost = settings.api_hostname.replace(/\/$/, "");
    }
    catch {
        /* use fallback host */
    }
    const url = `${apiHost}/api/live/stream/${encodeURIComponent(uvid)}` +
        `?key=${encodeURIComponent(key)}&platform=chrome&autoplay=0`;
    const data = await request.json(url, {
        headers: {
            Accept: "application/json",
            Referer: `${exports.GBNEWS_ORIGIN}/`,
            Origin: exports.GBNEWS_ORIGIN,
        },
    });
    const stream = data.response?.stream;
    if (!stream)
        throw new Error(`gbnews: no live stream for uvid ${uvid}`);
    return stream;
}
async function resolveGbnewsChannel(request, channelRef) {
    const raw = channelRef.trim();
    const channels = await discoverGbnewsChannels(request);
    if (/^\d+$/.test(raw)) {
        const byUvid = channels.find(c => c.uvid === raw);
        if (byUvid)
            return byUvid;
        return {
            id: raw,
            slug: raw,
            title: `GB News ${raw}`,
            pageUrl: exports.GBNEWS_LIVE_URL,
            uvid: raw,
            playerId: exports.GBNEWS_DEFAULT_PLAYER_ID,
            key: exports.GBNEWS_DEFAULT_KEY,
            thumbnail: `https://thumbnails.simplestreamcdn.com/gbnews/channel/${raw}.jpg?width=700&lang=en`,
        };
    }
    const slug = normalizeGbnewsChannelId(raw);
    const found = channels.find(c => c.slug === slug || c.id === slug);
    if (!found)
        throw new Error(`gbnews: unknown channel ${channelRef}`);
    return found;
}
async function extractGbnewsLiveFromPage(request, pageUrl) {
    const html = await request.text(pageUrl, {
        headers: {
            Accept: "text/html,application/xhtml+xml",
            Referer: `${exports.GBNEWS_ORIGIN}/`,
        },
    });
    const cfg = parseGbnewsPlayerConfig(html);
    const uvid = cfg.uvid || "1069";
    const key = cfg.key || exports.GBNEWS_DEFAULT_KEY;
    const playerId = cfg.playerId || exports.GBNEWS_DEFAULT_PLAYER_ID;
    const streamUrl = await fetchGbnewsStreamUrl(request, uvid, key, playerId);
    const isGbn2 = /live-2/i.test(pageUrl);
    return {
        uvid,
        streamUrl,
        title: cfg.title || (isGbn2 ? "GBN 2 Live" : "GBN 1 Live"),
        thumbnail: cfg.thumbnail ||
            `https://thumbnails.simplestreamcdn.com/gbnews/channel/${uvid}.jpg?width=700&lang=en`,
        pageUrl,
    };
}
//# sourceMappingURL=client.js.map