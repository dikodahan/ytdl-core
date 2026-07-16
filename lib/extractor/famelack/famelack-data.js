"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FAMELACK_TV_CATEGORIES = exports.FAMELACK_DATA_ROOT = void 0;
exports.isCountryScope = isCountryScope;
exports.channelPageUrl = channelPageUrl;
exports.listingPageUrl = listingPageUrl;
exports.normalizeChannel = normalizeChannel;
exports.youtubeWatchUrls = youtubeWatchUrls;
exports.fetchCountriesMetadata = fetchCountriesMetadata;
exports.fetchScopeChannels = fetchScopeChannels;
exports.findChannel = findChannel;
exports.channelsToListEntries = channelsToListEntries;
exports.buildCountryCategories = buildCountryCategories;
exports.buildTvCategoryIndex = buildTvCategoryIndex;
exports.FAMELACK_DATA_ROOT = "https://raw.githubusercontent.com/famelack/famelack-data/main/tv/raw";
exports.FAMELACK_TV_CATEGORIES = [
    "animation",
    "auto",
    "business",
    "classic",
    "comedy",
    "cooking",
    "culture",
    "documentary",
    "education",
    "entertainment",
    "family",
    "general",
    "interactive",
    "kids",
    "legislative",
    "lifestyle",
    "movies",
    "music",
    "news",
    "outdoor",
    "public",
    "relax",
    "religious",
    "science",
    "series",
    "shop",
    "show",
    "sports",
    "top-news",
    "travel",
    "weather",
];
const metadataCache = new Map();
const channelListCache = new Map();
function isCountryScope(scope) {
    return /^[a-z]{2}$/i.test(scope);
}
function channelPageUrl(scope, nanoid) {
    return `https://famelack.com/tv/${scope.toLowerCase()}/${nanoid}`;
}
function listingPageUrl(scope) {
    return `https://famelack.com/tv/${scope.toLowerCase()}`;
}
function titleCaseSlug(slug) {
    return slug
        .split(/[-_]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}
function normalizeChannel(raw) {
    const streams = raw.sources?.streams || [];
    const youtube = raw.sources?.youtube || [];
    return {
        nanoid: raw.nanoid,
        name: raw.name?.trim() || "[Unnamed]",
        country: raw.country?.toLowerCase() || null,
        languages: Array.isArray(raw.languages) ? raw.languages.filter(Boolean) : [],
        streamUrls: streams.filter(Boolean),
        youtubeUrls: youtube.filter(Boolean),
        isGeoBlocked: Boolean(raw.isGeoBlocked),
    };
}
function youtubeWatchUrl(embedOrWatchUrl) {
    const m = embedOrWatchUrl.match(/(?:embed\/|v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/) ||
        embedOrWatchUrl.match(/^([A-Za-z0-9_-]{11})$/);
    const id = m?.[1];
    return id ? `https://www.youtube.com/watch?v=${id}` : null;
}
function youtubeWatchUrls(channel) {
    const out = [];
    const seen = new Set();
    for (const raw of channel.youtubeUrls) {
        const watch = youtubeWatchUrl(raw);
        if (!watch || seen.has(watch))
            continue;
        seen.add(watch);
        out.push(watch);
    }
    return out;
}
async function fetchCountriesMetadata(request) {
    const cached = metadataCache.get("tv");
    if (cached)
        return cached;
    const data = await request.json(`${exports.FAMELACK_DATA_ROOT}/countries_metadata.json`);
    metadataCache.set("tv", data);
    return data;
}
async function fetchChannelList(request, kind, scope) {
    const key = `${kind}:${scope.toLowerCase()}`;
    const cached = channelListCache.get(key);
    if (cached)
        return cached;
    const data = await request.json(`${exports.FAMELACK_DATA_ROOT}/${kind}/${scope.toLowerCase()}.json`);
    const list = Array.isArray(data) ? data : [];
    channelListCache.set(key, list);
    return list;
}
async function fetchScopeChannels(request, scope) {
    const normalized = scope.trim().toLowerCase();
    if (!normalized)
        throw new Error("famelack: missing country or category scope");
    if (isCountryScope(normalized)) {
        return fetchChannelList(request, "countries", normalized);
    }
    return fetchChannelList(request, "categories", normalized);
}
async function findChannel(request, scope, nanoid) {
    const list = await fetchScopeChannels(request, scope);
    const raw = list.find(entry => entry.nanoid === nanoid);
    return raw ? normalizeChannel(raw) : null;
}
function channelsToListEntries(channels, scope) {
    return channels.map(raw => {
        const channel = normalizeChannel(raw);
        return {
            id: channel.nanoid,
            url: channelPageUrl(scope, channel.nanoid),
            title: channel.name,
            display_id: channel.nanoid,
        };
    });
}
async function buildCountryCategories(request) {
    const metadata = await fetchCountriesMetadata(request);
    return Object.entries(metadata)
        .filter(([, meta]) => meta.hasChannels && (meta.channelCount ?? 0) > 0)
        .map(([code, meta]) => ({
        id: code,
        title: meta.country,
        url: listingPageUrl(code),
        display_id: code.toLowerCase(),
    }))
        .sort((a, b) => a.title.localeCompare(b.title));
}
function buildTvCategoryIndex() {
    return exports.FAMELACK_TV_CATEGORIES.map(slug => ({
        id: slug,
        title: titleCaseSlug(slug),
        url: listingPageUrl(slug),
        display_id: slug,
    }));
}
//# sourceMappingURL=famelack-data.js.map