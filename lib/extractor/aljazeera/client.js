"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AJ_CHANNEL_ALIASES = exports.AJ_CHANNEL_LIVE_URLS = exports.AJ_CHANNELS_URL = exports.AJ_NETWORK_ORIGIN = void 0;
exports.ajChannelPageUrl = ajChannelPageUrl;
exports.normalizeAjChannelId = normalizeAjChannelId;
exports.resolveAjLiveUrl = resolveAjLiveUrl;
exports.wpSiteForHost = wpSiteForHost;
exports.postTypeFromPathType = postTypeFromPathType;
exports.parseAjChannelsHtml = parseAjChannelsHtml;
exports.discoverAjChannels = discoverAjChannels;
exports.findBrightcovePlayerUrl = findBrightcovePlayerUrl;
exports.findYoutubeVideoId = findYoutubeVideoId;
exports.fetchAjArticleVideo = fetchAjArticleVideo;
exports.brightcoveUrlFromVideo = brightcoveUrlFromVideo;
exports.AJ_NETWORK_ORIGIN = "https://network.aljazeera.net";
exports.AJ_CHANNELS_URL = `${exports.AJ_NETWORK_ORIGIN}/en/channels`;
/** Broadcast / streamable channel IDs → live watch pages. */
exports.AJ_CHANNEL_LIVE_URLS = {
    aljazeera: "https://www.aljazeera.net/live",
    "aljazeera-english": "https://www.aljazeera.com/live",
    "aljazeera-mubasher": "https://mubasher.aljazeera.net/",
    "aljazeera-documentary": "https://doc.aljazeera.net/",
};
/** Short aliases for `aljazeera:{alias}` pseudo-URLs. */
exports.AJ_CHANNEL_ALIASES = {
    arabic: "aljazeera",
    aja: "aljazeera",
    english: "aljazeera-english",
    aje: "aljazeera-english",
    mubasher: "aljazeera-mubasher",
    ajm: "aljazeera-mubasher",
    documentary: "aljazeera-documentary",
    doc: "aljazeera-documentary",
    ajd: "aljazeera-documentary",
};
const WP_SITE_BY_HOST = {
    "balkans.aljazeera.net": "ajb",
    "chinese.aljazeera.net": "chinese",
    "mubasher.aljazeera.net": "ajm",
    "www.aljazeera.com": "aje",
    "aljazeera.com": "aje",
    "www.aljazeera.net": "aja",
    "aljazeera.net": "aja",
};
const BRIGHTCOVE_EMBED_RE = /https?:\/\/players\.brightcove\.net\/(?<account>\d+)\/(?<player>[^/_]+)_(?<embed>[^/?#]+)\/index\.html\?(?:[^"'<\s]*&)?(?:videoId|playlistId)=(?<id>\d+|ref:[^&"'<\s]+)/i;
const YOUTUBE_EMBED_RE = /(?:youtube\.com\/embed\/|youtu\.be\/)(?<id>[A-Za-z0-9_-]{11})/i;
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
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ");
}
function ajChannelPageUrl(channelId) {
    return `${exports.AJ_CHANNELS_URL}/${channelId}`;
}
function normalizeAjChannelId(raw) {
    const key = raw.trim().toLowerCase();
    return exports.AJ_CHANNEL_ALIASES[key] || key;
}
function resolveAjLiveUrl(channelId) {
    return exports.AJ_CHANNEL_LIVE_URLS[normalizeAjChannelId(channelId)] || null;
}
function wpSiteForHost(host) {
    return WP_SITE_BY_HOST[host.toLowerCase()] || "aje";
}
function postTypeFromPathType(typePath) {
    const head = (typePath || "news").split("/")[0].toLowerCase();
    const map = {
        features: "post",
        feature: "post",
        program: "episode",
        programs: "episode",
        videos: "video",
        video: "video",
        news: "news",
    };
    return map[head] || "news";
}
/** Discover channel IDs from network.aljazeera.net/{en|ar}/channels. */
function parseAjChannelsHtml(html, listUrl = exports.AJ_CHANNELS_URL) {
    const out = [];
    const seen = new Set();
    const re = /<h5[^>]*>\s*([\s\S]*?)\s*<\/h5>[\s\S]{0,1600}?href="(\/(?:en|ar)\/channels\/([^"#]+))"/gi;
    let m;
    while ((m = re.exec(html))) {
        const title = decodeHtml(m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
        const id = decodeURIComponent(m[3]).trim();
        if (!id || seen.has(id))
            continue;
        seen.add(id);
        const window = html.slice(m.index, m.index + 1800);
        const img = window.match(/<img[^>]+src="([^"]+)"/i)?.[1] || null;
        out.push({
            id,
            title: title || id,
            pageUrl: ajChannelPageUrl(id),
            thumbnail: img ? absUrl(img, listUrl) : null,
            liveUrl: resolveAjLiveUrl(id),
        });
    }
    return out;
}
async function discoverAjChannels(request) {
    const html = await request.text(exports.AJ_CHANNELS_URL, {
        headers: {
            Accept: "text/html,application/xhtml+xml",
            Referer: `${exports.AJ_NETWORK_ORIGIN}/`,
        },
    });
    const channels = parseAjChannelsHtml(html, exports.AJ_CHANNELS_URL);
    if (!channels.length)
        throw new Error("aljazeera: no channels found on network channels page");
    return channels;
}
function findBrightcovePlayerUrl(html) {
    const m = html.match(BRIGHTCOVE_EMBED_RE);
    if (!m?.groups)
        return null;
    const { account, player, embed, id } = m.groups;
    return `https://players.brightcove.net/${account}/${player}_${embed}/index.html?videoId=${id}`;
}
function findYoutubeVideoId(html) {
    return html.match(YOUTUBE_EMBED_RE)?.groups?.id || null;
}
async function fetchAjArticleVideo(request, pageUrl, displayId, pathType) {
    const host = new URL(pageUrl).hostname;
    const wpSite = wpSiteForHost(host);
    const postType = postTypeFromPathType(pathType);
    const variables = JSON.stringify({ name: displayId, postType });
    const api = new URL(`https://${host}/graphql`);
    api.searchParams.set("wp-site", wpSite);
    api.searchParams.set("operationName", "ArchipelagoSingleArticleQuery");
    api.searchParams.set("variables", variables);
    try {
        const data = await request.json(api.toString(), {
            headers: {
                Accept: "application/json",
                "wp-site": wpSite,
                Referer: pageUrl,
            },
        });
        const article = data.data?.article;
        if (article?.video?.id) {
            return { title: article.title || null, video: article.video, webpage: null };
        }
    }
    catch {
        /* fall through to webpage scrape */
    }
    const webpage = await request.text(pageUrl, {
        headers: { Accept: "text/html,application/xhtml+xml", Referer: `https://${host}/` },
    });
    return { title: null, video: null, webpage };
}
function brightcoveUrlFromVideo(video) {
    const account = video.accountId || "911432371001";
    const player = video.playerId || "csvTfAlKW";
    const id = video.id;
    return `https://players.brightcove.net/${account}/${player}_default/index.html?videoId=${id}`;
}
//# sourceMappingURL=client.js.map