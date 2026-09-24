"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERCEPTION_ORIGIN = exports.GBNEWS_LIVE_URL = exports.normalizeGbnewsChannelId = exports.GbnewsIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const client_1 = require("./client");
/** Watch live pages: `/watch/live` and `/watch/live-2`. */
const LIVE_PAGE_URL = /^https?:\/\/(?:www\.)?gbnews\.com\/watch\/live(?:-2)?\/?(?:[?#]|$)/i;
/** Direct Perception.tv HLS (session `mwk` URLs). */
const PERCEPTION_HLS_URL = /^https?:\/\/(?:[\w-]+\.)?perception\.tv\/[^?\s]+\.m3u8(?:\?[^\s]*)?$/i;
/** Pseudo: `gbnews:gbn1`, `gbnews:385`, `gbnews:channels`. */
const PSEUDO_URL = /^gbnews:(?<id>channels|[a-z0-9-]+)(?:[?#]|$)/i;
const LIST_URL_PATTERNS = [
    LIVE_PAGE_URL,
    /^https?:\/\/(?:www\.)?gbnews\.com\/watch\/?(?:[?#]|$)/i,
    /^gbnews:channels$/i,
];
function isListOnlyPseudo(url) {
    return /^gbnews:channels$/i.test(url);
}
class GbnewsIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "gbnews";
    static IE_DESC = "GB News live (Perception.tv HLS)";
    static _VALID_URL = /^(?:gbnews:(?!channels$)[a-z0-9-]+|https?:\/\/(?:www\.)?gbnews\.com\/watch\/live(?:-2)?\/?(?:[?#]|$)|https?:\/\/(?:[\w-]+\.)?perception\.tv\/[^?\s]+\.m3u8(?:\?[^\s]*)?)/i;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — signed Catherine API → mwk HLS`,
            validUrl: String(this._VALID_URL),
            options: [],
            status: "ready",
            notes: "Discover channels at `https://www.gbnews.com/watch/live`, then extract `gbnews:gbn1` / `gbnews:385`. Stream URLs are Perception.tv HLS with a short-lived `mwk` token.",
            listSupported: true,
        };
    }
    static suitable(url) {
        if (LIST_URL_PATTERNS.some(re => re.test(url) && !LIVE_PAGE_URL.test(url)))
            return false;
        if (isListOnlyPseudo(url))
            return false;
        return (LIVE_PAGE_URL.test(url) ||
            PERCEPTION_HLS_URL.test(url) ||
            (!!url.match(PSEUDO_URL)?.groups?.id && !isListOnlyPseudo(url)));
    }
    static listUrlSupported(url) {
        if (PERCEPTION_HLS_URL.test(url))
            return false;
        if (PSEUDO_URL.test(url) && !isListOnlyPseudo(url))
            return false;
        return LIST_URL_PATTERNS.some(re => re.test(url));
    }
    async extract(url) {
        if (PERCEPTION_HLS_URL.test(url)) {
            return this.infoFromHls((0, client_1.withHlsClientParams)(url), url, "GB News Live", null);
        }
        if (LIVE_PAGE_URL.test(url)) {
            const live = await (0, client_1.extractGbnewsLiveFromPage)(this.request, url);
            return this.infoFromHls(live.streamUrl, live.pageUrl, live.title, live.thumbnail, live.channelId);
        }
        const pseudo = url.match(PSEUDO_URL);
        if (pseudo?.groups?.id) {
            const channel = await (0, client_1.resolveGbnewsChannel)(this.request, pseudo.groups.id);
            const streamUrl = await (0, client_1.fetchPerceptionStreamUrl)(this.request, channel.id);
            return this.infoFromHls(streamUrl, channel.pageUrl, channel.title, channel.thumbnail, channel.id, channel.slug);
        }
        throw new Error(`gbnews: unsupported URL ${url}`);
    }
    async listVideos(url, options = {}) {
        if (!GbnewsIE.listUrlSupported(url)) {
            throw new Error("gbnews: not a listing URL (use https://www.gbnews.com/watch/live)");
        }
        let channels = await (0, client_1.discoverGbnewsChannels)(this.request);
        if (options.limit && options.limit > 0)
            channels = channels.slice(0, options.limit);
        return {
            extractor: GbnewsIE.IE_NAME,
            webpage_url: client_1.GBNEWS_CHANNELS_URL,
            playlist_id: "channels",
            playlist_title: "GB News live channels",
            page: 1,
            entries: channels.map(ch => this.entryFromChannel(ch)),
            next_page_url: null,
        };
    }
    async listCategories(_url = client_1.GBNEWS_CHANNELS_URL, options = {}) {
        let channels = await (0, client_1.discoverGbnewsChannels)(this.request);
        if (options.limit && options.limit > 0)
            channels = channels.slice(0, options.limit);
        return {
            extractor: GbnewsIE.IE_NAME,
            webpage_url: client_1.GBNEWS_CHANNELS_URL,
            entries: channels.map(ch => ({
                id: ch.id,
                title: ch.title,
                url: ch.pageUrl,
                display_id: ch.slug,
                thumbnail: ch.thumbnail,
            })),
        };
    }
    entryFromChannel(ch) {
        return {
            id: ch.id,
            url: `gbnews:${ch.slug}`,
            title: ch.title,
            display_id: ch.slug,
            thumbnail: ch.thumbnail,
        };
    }
    infoFromHls(streamUrl, pageUrl, title, thumbnail, channelId, slug) {
        const format = (0, helpers_1.hlsFormat)(streamUrl, "hls");
        format.http_headers = {
            Referer: `${client_1.GBNEWS_ORIGIN}/`,
            Origin: client_1.GBNEWS_ORIGIN,
        };
        format.manifest_url = streamUrl;
        return (0, helpers_1.baseInfo)(GbnewsIE.IE_NAME, pageUrl, {
            id: channelId || slug || "live",
            display_id: slug || channelId || "live",
            title,
            thumbnail,
            live_status: "is_live",
            age_limit: 0,
            formats: [format],
        });
    }
}
exports.GbnewsIE = GbnewsIE;
var client_2 = require("./client");
Object.defineProperty(exports, "normalizeGbnewsChannelId", { enumerable: true, get: function () { return client_2.normalizeGbnewsChannelId; } });
var client_3 = require("./client");
Object.defineProperty(exports, "GBNEWS_LIVE_URL", { enumerable: true, get: function () { return client_3.GBNEWS_LIVE_URL; } });
Object.defineProperty(exports, "PERCEPTION_ORIGIN", { enumerable: true, get: function () { return client_3.PERCEPTION_ORIGIN; } });
//# sourceMappingURL=gbnews.js.map