"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unescapeJsString = exports.extractSignedStreamUrl = exports.LNN_HOME_URL = exports.LNN_ORIGIN = exports.LiveNewsNowIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const client_1 = require("./client");
/** Pseudo: `livenewsnow:foxnews`, `livenewsnow:featured/foxnews`, `livenewsnow:american`, `livenewsnow:categories`. */
const PSEUDO_URL = /^livenewsnow:(?<id>categories|american|business|(?:(?:american|business|featured)\/)?[a-z0-9-]+)(?:[?#]|$)/i;
const LIST_URL_PATTERNS = [
    client_1.CATEGORY_PAGE_URL,
    /^https?:\/\/(?:www\.)?livenewsnow\.com\/?(?:[?#]|$)/i,
    /^livenewsnow:(?:categories|american|business)$/i,
];
function isListOnlyPseudo(url) {
    return /^livenewsnow:(?:categories|american|business)$/i.test(url);
}
function isChannelPseudo(url) {
    const m = url.match(PSEUDO_URL);
    if (!m?.groups?.id || isListOnlyPseudo(url))
        return false;
    const parsed = (0, client_1.parseLnnPseudoId)(m.groups.id);
    return parsed?.kind === "channel";
}
class LiveNewsNowIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "livenewsnow";
    static IE_DESC = "Live News Now live channels (livenewsnow.com)";
    static _VALID_URL = /^(?:livenewsnow:(?!categories$|american$|business$)(?:(?:american|business|featured)\/)?[a-z0-9-]+|https?:\/\/(?:www\.)?livenewsnow\.com\/(?:american|business|featured)\/[a-z0-9-]+(?:\.html)?\/?(?:[?#]|$)|https?:\/\/(?:[\w.-]+\.)?livenewsplay(?:er)?\.com(?::\d+)?\/[^\s]+\.m3u8(?:\?[^\s]*)?)/i;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — signed HLS (token/expires/sig)`,
            validUrl: String(this._VALID_URL),
            options: [],
            status: "ready",
            notes: "Extract mints a fresh signed HLS URL via `?renew=1` when available (otherwise scrapes the page embed). Discover channels with `livenewsnow:categories`. Streams include signed query params (`token`/`expires`/`sig` or `sec*`/`newz*`).",
            listSupported: true,
        };
    }
    static suitable(url) {
        if (LIST_URL_PATTERNS.some(re => re.test(url) && !client_1.CHANNEL_PAGE_URL.test(url)))
            return false;
        if (isListOnlyPseudo(url))
            return false;
        return (client_1.CHANNEL_PAGE_URL.test(url) ||
            client_1.SIGNED_HLS_URL.test(url) ||
            isChannelPseudo(url));
    }
    static listUrlSupported(url) {
        if (client_1.CHANNEL_PAGE_URL.test(url))
            return false;
        if (client_1.SIGNED_HLS_URL.test(url))
            return false;
        if (isChannelPseudo(url))
            return false;
        return LIST_URL_PATTERNS.some(re => re.test(url));
    }
    async extract(url) {
        if (client_1.SIGNED_HLS_URL.test(url)) {
            return this.infoFromStream(url, url, "Live News Now", null, "live");
        }
        const page = (0, client_1.parseChannelPageUrl)(url);
        if (page) {
            const live = await (0, client_1.extractLnnStreamFromPage)(this.request, page.pageUrl);
            return this.infoFromStream(live.streamUrl, live.pageUrl, live.title, live.thumbnail, live.channelId, page.slug);
        }
        const pseudo = url.match(PSEUDO_URL);
        if (pseudo?.groups?.id) {
            const parsed = (0, client_1.parseLnnPseudoId)(pseudo.groups.id);
            if (parsed?.kind === "channel" && parsed.slug) {
                const channel = await (0, client_1.resolveLnnChannel)(this.request, {
                    section: parsed.section,
                    slug: parsed.slug,
                });
                const live = await (0, client_1.extractLnnStreamFromPage)(this.request, channel.pageUrl);
                return this.infoFromStream(live.streamUrl, live.pageUrl, live.title || channel.title, live.thumbnail || channel.thumbnail, live.channelId, channel.displayId);
            }
        }
        throw new Error(`livenewsnow: unsupported URL ${url}`);
    }
    async listVideos(url, options = {}) {
        if (!LiveNewsNowIE.listUrlSupported(url)) {
            throw new Error("livenewsnow: not a listing URL (use /category/american, /category/business, or livenewsnow:categories)");
        }
        const categoryId = this.resolveListCategory(url);
        let channels;
        let webpageUrl;
        let playlistId;
        let playlistTitle;
        if (categoryId) {
            channels = await (0, client_1.discoverLnnCategoryChannels)(this.request, categoryId);
            webpageUrl = (0, client_1.lnnCategoryUrl)(categoryId);
            playlistId = categoryId;
            playlistTitle = `Live News Now — ${categoryId}`;
        }
        else {
            channels = await (0, client_1.discoverAllLnnChannels)(this.request);
            webpageUrl = client_1.LNN_HOME_URL;
            playlistId = "channels";
            playlistTitle = "Live News Now channels";
        }
        if (options.limit && options.limit > 0)
            channels = channels.slice(0, options.limit);
        return {
            extractor: LiveNewsNowIE.IE_NAME,
            webpage_url: webpageUrl,
            playlist_id: playlistId,
            playlist_title: playlistTitle,
            page: 1,
            entries: channels.map(ch => this.entryFromChannel(ch)),
            next_page_url: null,
        };
    }
    async listCategories(_url = client_1.LNN_HOME_URL, options = {}) {
        let categories = (0, client_1.listLnnCategories)();
        if (options.limit && options.limit > 0)
            categories = categories.slice(0, options.limit);
        return {
            extractor: LiveNewsNowIE.IE_NAME,
            webpage_url: client_1.LNN_HOME_URL,
            entries: categories.map(c => ({
                id: c.id,
                title: c.title,
                url: c.url,
                display_id: c.id,
                thumbnail: null,
            })),
        };
    }
    resolveListCategory(url) {
        const fromPage = (0, client_1.parseCategoryPageUrl)(url);
        if (fromPage)
            return fromPage;
        const pseudo = url.match(PSEUDO_URL);
        if (pseudo?.groups?.id) {
            const parsed = (0, client_1.parseLnnPseudoId)(pseudo.groups.id);
            if (parsed?.kind === "category" && parsed.categoryId)
                return parsed.categoryId;
        }
        return null;
    }
    entryFromChannel(ch) {
        return {
            id: ch.id,
            url: `livenewsnow:${ch.displayId}`,
            title: ch.title,
            display_id: ch.displayId,
            thumbnail: ch.thumbnail,
        };
    }
    infoFromStream(streamUrl, pageUrl, title, thumbnail, channelId, displayId) {
        const format = (0, helpers_1.hlsFormat)(streamUrl, "hls");
        format.http_headers = { ...client_1.LNN_STREAM_HEADERS };
        format.manifest_url = streamUrl;
        return (0, helpers_1.baseInfo)(LiveNewsNowIE.IE_NAME, pageUrl, {
            id: channelId,
            display_id: displayId || channelId,
            title,
            thumbnail,
            live_status: "is_live",
            age_limit: 0,
            formats: [format],
        });
    }
}
exports.LiveNewsNowIE = LiveNewsNowIE;
var client_2 = require("./client");
Object.defineProperty(exports, "LNN_ORIGIN", { enumerable: true, get: function () { return client_2.LNN_ORIGIN; } });
Object.defineProperty(exports, "LNN_HOME_URL", { enumerable: true, get: function () { return client_2.LNN_HOME_URL; } });
Object.defineProperty(exports, "extractSignedStreamUrl", { enumerable: true, get: function () { return client_2.extractSignedStreamUrl; } });
Object.defineProperty(exports, "unescapeJsString", { enumerable: true, get: function () { return client_2.unescapeJsString; } });
//# sourceMappingURL=livenewsnow.js.map