"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.I24_REQUEST_HEADERS = exports.I24_REGIONS_URL = exports.I24_TENANT_ID = exports.I24_API_BASE = exports.I24_VIDEO_ORIGIN = void 0;
exports.fetchI24Config = fetchI24Config;
exports.fetchI24Section = fetchI24Section;
exports.fetchI24Channel = fetchI24Channel;
exports.i24RegionPageUrl = i24RegionPageUrl;
exports.i24ChannelPageUrl = i24ChannelPageUrl;
exports.discoverI24Regions = discoverI24Regions;
exports.discoverI24LiveChannels = discoverI24LiveChannels;
exports.pickPrimaryLiveChannel = pickPrimaryLiveChannel;
exports.I24_VIDEO_ORIGIN = "https://video.i24news.tv";
exports.I24_API_BASE = "https://insight-api-shared.univtec.com/";
exports.I24_TENANT_ID = "i24israel";
exports.I24_REGIONS_URL = `${exports.I24_VIDEO_ORIGIN}/regions`;
const DEFAULT_HEADERS = {
    Accept: "application/json",
    Origin: exports.I24_VIDEO_ORIGIN,
    Referer: `${exports.I24_VIDEO_ORIGIN}/`,
    platform: "web",
    "x-device-type": "web",
    "x-tenant-id": exports.I24_TENANT_ID,
    "x-device": "ytdl-core",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
};
exports.I24_REQUEST_HEADERS = DEFAULT_HEADERS;
function apiHeaders(regionCode) {
    const headers = { ...DEFAULT_HEADERS };
    if (regionCode)
        headers.regioncode = regionCode;
    return headers;
}
async function apiJson(request, path, regionCode) {
    const url = path.startsWith("http") ? path : `${exports.I24_API_BASE}${path.replace(/^\//, "")}`;
    return request.json(url, { headers: apiHeaders(regionCode) });
}
async function fetchI24Config(request, regionCode) {
    return apiJson(request, "interface/customers/config", regionCode);
}
async function fetchI24Section(request, sectionId, regionCode) {
    return apiJson(request, `interface/pages/section/${sectionId}`, regionCode);
}
async function fetchI24Channel(request, channelId, regionCode = "all") {
    const data = await apiJson(request, `interface/pages/channel/${channelId}`, regionCode);
    const item = Array.isArray(data) ? data[0] : data;
    if (!item?.videoUrl) {
        throw new Error(`i24: channel ${channelId} has no videoUrl`);
    }
    return {
        id: item.id || channelId,
        title: item.title || item.name || channelId,
        videoUrl: item.videoUrl,
        thumbnail: item.thumbnail || item.image || item.poster || null,
    };
}
function isLiveSectionTitle(title) {
    const t = (title || "").trim().toLowerCase();
    return t === "live" || t === "שידור חי" || t.includes("live");
}
function isLivePageName(name) {
    const t = (name || "").trim().toLowerCase();
    return t === "live" || t === "שידור חי";
}
function collectLiveSectionIds(pages) {
    const ids = [];
    for (const page of pages) {
        const sections = page.sections || [];
        if (page.main) {
            for (const section of sections) {
                if (isLiveSectionTitle(section.title))
                    ids.push(section.id);
            }
            continue;
        }
        if (isLivePageName(page.name)) {
            for (const section of sections)
                ids.push(section.id);
        }
    }
    return [...new Set(ids)];
}
function i24RegionPageUrl(regionCode, pageId) {
    return `${exports.I24_VIDEO_ORIGIN}/r/${regionCode}/page/${pageId}`;
}
function i24ChannelPageUrl(channelId) {
    return `${exports.I24_VIDEO_ORIGIN}/player/channel/${channelId}`;
}
/** Discover region landing pages from the Univtec config (regions picker). */
async function discoverI24Regions(request) {
    const base = await fetchI24Config(request, "all");
    const regionDefs = base.config?.features?.regions?.regions || [];
    if (!regionDefs.length)
        throw new Error("i24: no regions in config");
    const out = [];
    for (const def of regionDefs) {
        const regionCode = def.regionCode;
        const cfg = regionCode === "all" ? base : await fetchI24Config(request, regionCode);
        const pages = cfg.config?.pages || [];
        const home = pages.find(p => p.main) || pages[0];
        if (!home?._id)
            continue;
        out.push({
            regionCode,
            displayName: cfg.displayName || def.displayName || regionCode,
            regionImage: def.regionImage,
            pageId: home._id,
            pageUrl: i24RegionPageUrl(regionCode, home._id),
        });
    }
    return out;
}
/** Live linear channels exposed on a region's home / live sections. */
async function discoverI24LiveChannels(request, regionCode) {
    const cfg = await fetchI24Config(request, regionCode);
    const pages = cfg.config?.pages || [];
    const sectionIds = collectLiveSectionIds(pages);
    const byId = new Map();
    for (const sectionId of sectionIds) {
        const section = await fetchI24Section(request, sectionId, regionCode);
        for (const item of section.items || []) {
            if (!item.id || !item.videoUrl)
                continue;
            if (byId.has(item.id))
                continue;
            byId.set(item.id, {
                id: item.id,
                title: item.title || item.name || item.id,
                videoUrl: item.videoUrl,
                thumbnail: item.thumbnail || item.image || item.poster || null,
                regionCode,
            });
        }
    }
    return [...byId.values()];
}
/** Prefer the channel whose title matches the region language, else first. */
function pickPrimaryLiveChannel(channels, regionCode) {
    if (!channels.length)
        return undefined;
    const needles = {
        all: /english/i,
        hebrew: /hebrew|עברית/i,
        french: /fran[cç]ais|french/i,
        arabic: /arabic|عرب/i,
    };
    const re = needles[regionCode] || needles.all;
    return channels.find(c => re.test(c.title)) || channels[0];
}
//# sourceMappingURL=client.js.map