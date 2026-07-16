"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FamelackIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const famelack_data_1 = require("./famelack-data");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:www\.)?famelack\.com\/tv(?:\/(?<scope>[a-z]{2}|[a-z0-9+-]+))?(?:\/(?<id>[A-Za-z0-9]+))?\/?(?:[?#]|$)/i;
const LIST_URL_PATTERNS = [
    /^https?:\/\/(?:www\.)?famelack\.com\/tv(?:\/(?<scope>[a-z]{2}|[a-z0-9+-]+))?\/?(?:[?#]|$)/i,
];
function streamFormats(channel) {
    const formats = [];
    const seen = new Set();
    for (const [index, url] of channel.streamUrls.entries()) {
        if (seen.has(url))
            continue;
        seen.add(url);
        const formatId = channel.streamUrls.length > 1 ? `hls-${index + 1}` : "hls";
        if (/\.m3u8($|\?)/i.test(url) || /\.smil\/playlist\.m3u8/i.test(url)) {
            formats.push((0, helpers_1.hlsFormat)(url, formatId));
        }
        else {
            formats.push((0, helpers_1.progressiveFormat)(url, { format_id: formatId }));
        }
    }
    for (const [index, url] of (0, famelack_data_1.youtubeWatchUrls)(channel).entries()) {
        if (seen.has(url))
            continue;
        seen.add(url);
        formats.push((0, helpers_1.progressiveFormat)(url, {
            format_id: channel.streamUrls.length ? `youtube-${index + 1}` : "youtube",
            ext: "mp4",
            vcodec: "unknown",
            acodec: "unknown",
        }));
    }
    return formats;
}
class FamelackIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "famelack";
    static IE_DESC = "Famelack live TV channels";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — HLS / YouTube from famelack-data`,
            validUrl: String(this._VALID_URL),
            options: [],
            notes: "Paste a Famelack TV channel URL (`famelack.com/tv/{country|category}/{nanoid}`). Channel data comes from the public famelack-data GitHub repo.",
            listSupported: true,
        };
    }
    static listUrlSupported(url) {
        const m = url.match(VALID_URL);
        if (!m?.groups?.scope)
            return false;
        if (m.groups.id)
            return false;
        return LIST_URL_PATTERNS.some(re => re.test(url));
    }
    parseUrl(url) {
        const m = url.match(VALID_URL);
        return {
            scope: m?.groups?.scope?.toLowerCase(),
            id: m?.groups?.id,
        };
    }
    async extract(url) {
        const { scope, id } = this.parseUrl(url);
        if (!scope || !id) {
            throw new Error(`famelack: paste a channel URL like https://famelack.com/tv/us/{nanoid}`);
        }
        const channel = await (0, famelack_data_1.findChannel)(this.request, scope, id);
        if (!channel) {
            throw new Error(`famelack: channel ${id} not found under ${scope}`);
        }
        const formats = streamFormats(channel);
        if (!formats.length) {
            throw new Error(`famelack: no playable streams for ${channel.name} (${id})`);
        }
        const pageUrl = (0, famelack_data_1.channelPageUrl)(scope, id);
        const notes = [];
        if (channel.isGeoBlocked)
            notes.push("Marked geo-blocked on Famelack.");
        if (!channel.streamUrls.length && channel.youtubeUrls.length) {
            notes.push("YouTube-only channel; use the youtube extractor for best playback.");
        }
        return (0, helpers_1.baseInfo)("famelack", pageUrl, {
            id,
            display_id: id,
            title: channel.name,
            uploader: (0, famelack_data_1.isCountryScope)(scope) ? scope.toUpperCase() : titleCaseScope(scope),
            live_status: "is_live",
            age_limit: 0,
            formats,
            ...(notes.length ? { description: notes.join(" ") } : {}),
        });
    }
    async listVideos(url, options = {}) {
        const { scope } = this.parseUrl(url);
        if (!scope) {
            throw new Error(`famelack: not a listing URL (use /tv/{country} or /tv/{category})`);
        }
        const channels = await (0, famelack_data_1.fetchScopeChannels)(this.request, scope);
        let entries = (0, famelack_data_1.channelsToListEntries)(channels, scope);
        if (options.limit && options.limit > 0)
            entries = entries.slice(0, options.limit);
        const playlistTitle = (0, famelack_data_1.isCountryScope)(scope)
            ? `${scope.toUpperCase()} TV`
            : `${titleCaseScope(scope)} TV`;
        return {
            extractor: FamelackIE.IE_NAME,
            webpage_url: (0, famelack_data_1.listingPageUrl)(scope),
            playlist_id: scope,
            playlist_title: playlistTitle,
            page: 1,
            entries,
            next_page_url: null,
        };
    }
    async listCategories(url = "https://famelack.com/tv", options = {}) {
        const normalized = url.replace(/\/+$/, "") || "https://famelack.com/tv";
        let entries = normalized.endsWith("/tv") || normalized.includes("/tv/countries")
            ? await (0, famelack_data_1.buildCountryCategories)(this.request)
            : (0, famelack_data_1.buildTvCategoryIndex)();
        if (options.limit && options.limit > 0) {
            entries = entries.slice(0, options.limit);
        }
        return {
            extractor: FamelackIE.IE_NAME,
            webpage_url: normalized.endsWith("/tv") ? "https://famelack.com/tv" : normalized,
            entries,
        };
    }
}
exports.FamelackIE = FamelackIE;
function titleCaseScope(scope) {
    return scope
        .split(/[-_+]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}
//# sourceMappingURL=famelack.js.map