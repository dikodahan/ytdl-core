"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GBNEWS_LIVE_URL = exports.normalizeGbnewsChannelId = exports.GbnewsIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const client_1 = require("./client");
/** Watch live pages: `/watch/live` and `/watch/live-2`. */
const LIVE_PAGE_URL = /^https?:\/\/(?:www\.)?gbnews\.com\/watch\/live(?:-2)?\/?(?:[?#]|$)/i;
/** Direct Perception.tv HLS (browser SSAI variant). */
const PERCEPTION_HLS_URL = /^https?:\/\/(?:[\w-]+\.)?perception\.tv\/[^?\s]+\.m3u8(?:\?[^\s]*)?$/i;
/** Direct Simplestream / CDN HLS playlists for GB News. */
const DIRECT_HLS_URL = /^https?:\/\/(?:live-gbnews\.simplestreamcdn\.com|[\w.-]*gbnews[\w.-]*\.(?:cloudfront\.net|simplestreamcdn\.com))\/[^\s]+\.m3u8(?:\?[^\s]*)?$/i;
/** Pseudo: `gbnews:gbn1`, `gbnews:1069`, `gbnews:channels`. */
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
    static IE_DESC = "GB News live (Simplestream / Perception HLS)";
    static _VALID_URL = /^(?:gbnews:(?!channels$)[a-z0-9-]+|https?:\/\/(?:www\.)?gbnews\.com\/watch\/live(?:-2)?\/?(?:[?#]|$)|https?:\/\/(?:[\w-]+\.)?perception\.tv\/[^?\s]+\.m3u8(?:\?[^\s]*)?|https?:\/\/(?:live-gbnews\.simplestreamcdn\.com|[\w.-]*gbnews[\w.-]*\.(?:cloudfront\.net|simplestreamcdn\.com))\/[^\s]+\.m3u8(?:\?[^\s]*)?)/i;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — live HLS via Simplestream streams API`,
            validUrl: String(this._VALID_URL),
            options: [],
            status: "ready",
            notes: "Discover GBN 1/2 at `https://www.gbnews.com/watch/live`, then extract `gbnews:gbn1` / `gbnews:1069`. Stream links come from Simplestream (Perception.tv URLs are the ad-stitched browser variant).",
            listSupported: true,
        };
    }
    static suitable(url) {
        if (LIST_URL_PATTERNS.some(re => re.test(url) && !LIVE_PAGE_URL.test(url)))
            return false;
        if (isListOnlyPseudo(url))
            return false;
        // Live pages are both listable and extractable — prefer extract when suitable().
        return (LIVE_PAGE_URL.test(url) ||
            PERCEPTION_HLS_URL.test(url) ||
            DIRECT_HLS_URL.test(url) ||
            (!!url.match(PSEUDO_URL)?.groups?.id && !isListOnlyPseudo(url)));
    }
    static listUrlSupported(url) {
        if (PERCEPTION_HLS_URL.test(url) || DIRECT_HLS_URL.test(url))
            return false;
        if (PSEUDO_URL.test(url) && !isListOnlyPseudo(url))
            return false;
        return LIST_URL_PATTERNS.some(re => re.test(url));
    }
    async extract(url) {
        if (PERCEPTION_HLS_URL.test(url) || DIRECT_HLS_URL.test(url)) {
            return this.infoFromHls(url, url, "GB News Live", null);
        }
        if (LIVE_PAGE_URL.test(url)) {
            const live = await (0, client_1.extractGbnewsLiveFromPage)(this.request, url);
            return this.infoFromHls(live.streamUrl, live.pageUrl, live.title, live.thumbnail, live.uvid);
        }
        const pseudo = url.match(PSEUDO_URL);
        if (pseudo?.groups?.id) {
            const channel = await (0, client_1.resolveGbnewsChannel)(this.request, pseudo.groups.id);
            const streamUrl = await (0, client_1.fetchGbnewsStreamUrl)(this.request, channel.uvid, channel.key, channel.playerId);
            return this.infoFromHls(streamUrl, channel.pageUrl, channel.title, channel.thumbnail, channel.uvid, channel.slug);
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
                id: ch.slug,
                title: ch.title,
                url: ch.pageUrl,
                display_id: ch.uvid,
                thumbnail: ch.thumbnail,
            })),
        };
    }
    entryFromChannel(ch) {
        return {
            id: ch.uvid,
            url: `gbnews:${ch.slug}`,
            title: ch.title,
            display_id: ch.slug,
            thumbnail: ch.thumbnail,
        };
    }
    infoFromHls(streamUrl, pageUrl, title, thumbnail, uvid, slug) {
        const format = (0, helpers_1.hlsFormat)(streamUrl, "hls");
        format.http_headers = {
            Referer: `${client_1.GBNEWS_ORIGIN}/`,
            Origin: client_1.GBNEWS_ORIGIN,
        };
        format.manifest_url = streamUrl;
        return (0, helpers_1.baseInfo)(GbnewsIE.IE_NAME, pageUrl, {
            id: uvid || slug || "live",
            display_id: slug || uvid || "live",
            title,
            thumbnail,
            live_status: "is_live",
            age_limit: 0,
            formats: [format],
        });
    }
}
exports.GbnewsIE = GbnewsIE;
// Re-export helpers used by tests / callers
var client_2 = require("./client");
Object.defineProperty(exports, "normalizeGbnewsChannelId", { enumerable: true, get: function () { return client_2.normalizeGbnewsChannelId; } });
var client_3 = require("./client");
Object.defineProperty(exports, "GBNEWS_LIVE_URL", { enumerable: true, get: function () { return client_3.GBNEWS_LIVE_URL; } });
//# sourceMappingURL=gbnews.js.map