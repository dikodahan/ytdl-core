"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.I24IE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const client_1 = require("./client");
/** Region landing pages: `/r/{region}/page/{id}`. */
const PAGE_URL = /^https?:\/\/(?:www\.)?video\.i24news\.tv\/r\/(?<region>[a-z]+)\/page\/(?<id>[a-f0-9]{24})\/?(?:[?#]|$)/i;
/** Direct channel player: `/player/channel/{id}`. */
const CHANNEL_URL = /^https?:\/\/(?:www\.)?video\.i24news\.tv\/player\/channel\/(?<id>[a-f0-9]{24})\/?(?:[?#]|$)/i;
/** Pseudo: `i24:hebrew`, `i24:channel:{id}`. */
const PSEUDO_URL = /^i24:(?:(?:channel:)(?<channelId>[a-f0-9]{24})|(?<region>all|hebrew|french|arabic|english))$/i;
const LIST_URL_PATTERNS = [
    /^https?:\/\/(?:www\.)?video\.i24news\.tv\/regions\/?(?:[?#]|$)/i,
    /^https?:\/\/(?:www\.)?video\.i24news\.tv\/?(?:[?#]|$)/i,
    PAGE_URL,
    /^i24:regions$/i,
];
function normalizeRegionCode(raw) {
    const key = raw.trim().toLowerCase();
    if (key === "english" || key === "en")
        return "all";
    return key;
}
class I24IE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "i24";
    static IE_DESC = "i24NEWS live (video.i24news.tv / Univtec)";
    static _VALID_URL = /^(?:i24:(?:channel:[a-f0-9]{24}|all|hebrew|french|arabic|english)|https?:\/\/(?:www\.)?video\.i24news\.tv\/(?:r\/[a-z]+\/page\/[a-f0-9]{24}|player\/channel\/[a-f0-9]{24})\/?(?:[?#]|$))/i;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — HLS from Univtec live sections`,
            validUrl: String(this._VALID_URL),
            options: [],
            notes: "List regions via `https://video.i24news.tv/regions`, then extract a region page or `i24:hebrew` / channel URL.",
            listSupported: true,
        };
    }
    static suitable(url) {
        if (LIST_URL_PATTERNS.some(re => re.test(url) && !PAGE_URL.test(url)))
            return false;
        if (/^i24:regions$/i.test(url))
            return false;
        return (PAGE_URL.test(url) ||
            CHANNEL_URL.test(url) ||
            (!!url.match(PSEUDO_URL)?.groups?.channelId || !!url.match(PSEUDO_URL)?.groups?.region));
    }
    static listUrlSupported(url) {
        if (CHANNEL_URL.test(url))
            return false;
        if (PSEUDO_URL.test(url) && !/^i24:regions$/i.test(url))
            return false;
        return LIST_URL_PATTERNS.some(re => re.test(url));
    }
    async extract(url) {
        const channelMatch = url.match(CHANNEL_URL) || url.match(PSEUDO_URL);
        if (channelMatch?.groups?.channelId || channelMatch?.groups?.id) {
            const channelId = channelMatch.groups.channelId || channelMatch.groups.id;
            const channel = await (0, client_1.fetchI24Channel)(this.request, channelId, "all");
            return this.infoFromChannel(channel, (0, client_1.i24ChannelPageUrl)(channel.id));
        }
        const pageMatch = url.match(PAGE_URL);
        const pseudo = url.match(PSEUDO_URL);
        let regionCode;
        let pageId;
        if (pageMatch?.groups) {
            regionCode = normalizeRegionCode(pageMatch.groups.region);
            pageId = pageMatch.groups.id;
        }
        else if (pseudo?.groups?.region) {
            regionCode = normalizeRegionCode(pseudo.groups.region);
        }
        else {
            throw new Error(`i24: unsupported URL ${url}`);
        }
        const channels = await (0, client_1.discoverI24LiveChannels)(this.request, regionCode);
        const primary = (0, client_1.pickPrimaryLiveChannel)(channels, regionCode);
        if (!primary)
            throw new Error(`i24: no live channels for region ${regionCode}`);
        const pageUrl = pageId
            ? (0, client_1.i24RegionPageUrl)(regionCode, pageId)
            : (await this.regionByCode(regionCode)).pageUrl;
        return this.infoFromChannel(primary, pageUrl, regionCode);
    }
    async listVideos(url, options = {}) {
        if (!I24IE.listUrlSupported(url)) {
            throw new Error("i24: not a listing URL (use /regions or a /r/{region}/page/{id} URL)");
        }
        const pageMatch = url.match(PAGE_URL);
        if (pageMatch?.groups) {
            const regionCode = normalizeRegionCode(pageMatch.groups.region);
            let channels = await (0, client_1.discoverI24LiveChannels)(this.request, regionCode);
            if (options.limit && options.limit > 0)
                channels = channels.slice(0, options.limit);
            return {
                extractor: I24IE.IE_NAME,
                webpage_url: url,
                playlist_id: pageMatch.groups.id,
                playlist_title: `i24NEWS ${regionCode} live`,
                page: 1,
                entries: channels.map(ch => ({
                    id: ch.id,
                    url: (0, client_1.i24ChannelPageUrl)(ch.id),
                    title: ch.title,
                    display_id: ch.id,
                    thumbnail: ch.thumbnail || null,
                })),
                next_page_url: null,
            };
        }
        let regions = await (0, client_1.discoverI24Regions)(this.request);
        if (options.limit && options.limit > 0)
            regions = regions.slice(0, options.limit);
        return {
            extractor: I24IE.IE_NAME,
            webpage_url: client_1.I24_REGIONS_URL,
            playlist_id: "regions",
            playlist_title: "i24NEWS regions",
            page: 1,
            entries: regions.map(r => ({
                id: r.pageId,
                url: r.pageUrl,
                title: r.displayName,
                display_id: r.regionCode,
                thumbnail: r.regionImage || null,
            })),
            next_page_url: null,
        };
    }
    async listCategories(_url = client_1.I24_REGIONS_URL, options = {}) {
        let regions = await (0, client_1.discoverI24Regions)(this.request);
        if (options.limit && options.limit > 0)
            regions = regions.slice(0, options.limit);
        return {
            extractor: I24IE.IE_NAME,
            webpage_url: client_1.I24_REGIONS_URL,
            entries: regions.map(r => ({
                id: r.regionCode,
                title: r.displayName,
                url: r.pageUrl,
                display_id: r.regionCode,
                thumbnail: r.regionImage || null,
            })),
        };
    }
    async regionByCode(regionCode) {
        const regions = await (0, client_1.discoverI24Regions)(this.request);
        const found = regions.find(r => r.regionCode === regionCode);
        if (!found)
            throw new Error(`i24: unknown region ${regionCode}`);
        return found;
    }
    infoFromChannel(channel, pageUrl, regionCode) {
        const format = (0, helpers_1.hlsFormat)(channel.videoUrl, "hls");
        format.http_headers = { ...client_1.I24_REQUEST_HEADERS, Referer: `${client_1.I24_VIDEO_ORIGIN}/` };
        format.manifest_url = channel.videoUrl;
        return (0, helpers_1.baseInfo)(I24IE.IE_NAME, pageUrl, {
            id: channel.id,
            display_id: regionCode || channel.id,
            title: channel.title,
            thumbnail: channel.thumbnail || null,
            live_status: "is_live",
            age_limit: 0,
            formats: [format],
        });
    }
}
exports.I24IE = I24IE;
//# sourceMappingURL=i24.js.map