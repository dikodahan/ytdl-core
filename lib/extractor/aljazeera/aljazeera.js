"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlJazeeraIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const brightcove_1 = require("../brightcove");
const video_1 = require("../youtube/video");
const client_1 = require("./client");
/** Network channel about pages: `/en/channels/{id}`. */
const CHANNEL_PAGE_URL = /^https?:\/\/(?:www\.)?network\.aljazeera\.net\/(?:en|ar)\/channels\/(?<id>[^/?#]+)\/?(?:[?#]|$)/i;
/** Live / watch pages for AJ broadcast brands. */
const LIVE_PAGE_URL = /^https?:\/\/(?:www\.)?(?:aljazeera\.com\/(?:live|video\/live|watch)|aljazeera\.net\/(?:live|video\/live)|(?:mubasher|doc)\.aljazeera\.net\/?|aljazeeramubasher\.net\/?)(?:[?#]|$)/i;
/** Article / program video pages (yt-dlp AlJazeeraIE shape). */
const ARTICLE_URL = /^https?:\/\/(?<base>[\w-]+\.aljazeera\.\w+)\/(?<type>programs?\/[^/]+|(?:feature|video|new)s)?\/\d{4}\/\d{1,2}\/\d{1,2}\/(?<id>[^/?&#]+)\/?(?:[?#]|$)/i;
/** Pseudo: `aljazeera:channels`, `aljazeera:english`, `aljazeera:aljazeera-english`. */
const PSEUDO_URL = /^aljazeera:(?<id>channels|[a-z0-9-]+)(?:[?#]|$)/i;
const LIST_URL_PATTERNS = [
    /^https?:\/\/(?:www\.)?network\.aljazeera\.net\/(?:en|ar)\/channels\/?(?:[?#]|$)/i,
    /^aljazeera:channels$/i,
];
function isListOnlyPseudo(url) {
    return /^aljazeera:channels$/i.test(url);
}
class AlJazeeraIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "aljazeera";
    static IE_DESC = "Al Jazeera live channels + Brightcove articles";
    static _VALID_URL = /^(?:aljazeera:(?!channels$)[a-z0-9-]+|https?:\/\/(?:(?:www\.)?network\.aljazeera\.net\/(?:en|ar)\/channels\/[^/?#]+|(?:www\.)?(?:aljazeera\.com\/(?:live|video\/live|watch)|aljazeera\.net\/(?:live|video\/live)|(?:mubasher|doc)\.aljazeera\.net\/?|aljazeeramubasher\.net\/?)|(?:[\w-]+\.aljazeera\.\w+)\/(?:programs?\/[^/]+|(?:feature|video|new)s)?\/\d{4}\/\d{1,2}\/\d{1,2}\/[^/?&#]+))(?:[?#]|$)/i;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — HLS via Brightcove / YouTube live`,
            validUrl: String(this._VALID_URL),
            options: [],
            status: "ready",
            notes: "Discover channel IDs at `https://network.aljazeera.net/en/channels`, then extract `aljazeera:english` / channel page / live URL. Articles resolve through Brightcove.",
            listSupported: true,
        };
    }
    static suitable(url) {
        if (LIST_URL_PATTERNS.some(re => re.test(url)))
            return false;
        if (isListOnlyPseudo(url))
            return false;
        return (CHANNEL_PAGE_URL.test(url) ||
            LIVE_PAGE_URL.test(url) ||
            ARTICLE_URL.test(url) ||
            (!!url.match(PSEUDO_URL)?.groups?.id && !isListOnlyPseudo(url)));
    }
    static listUrlSupported(url) {
        return LIST_URL_PATTERNS.some(re => re.test(url));
    }
    async extract(url) {
        const article = url.match(ARTICLE_URL);
        if (article?.groups) {
            return this.extractArticle(url, article.groups.id, article.groups.type);
        }
        const channelId = this.channelIdFromUrl(url);
        if (channelId) {
            const liveUrl = (0, client_1.resolveAjLiveUrl)(channelId);
            if (!liveUrl) {
                throw new Error(`aljazeera: channel "${channelId}" has no known live stream (centres/institute are not livestreamed)`);
            }
            const info = await this.extractLivePage(liveUrl);
            info.display_id = channelId;
            info.webpage_url = (0, client_1.ajChannelPageUrl)(channelId);
            if (!info.title || info.title === info.id) {
                info.title = this.titleForChannelId(channelId);
            }
            return info;
        }
        if (LIVE_PAGE_URL.test(url)) {
            return this.extractLivePage(url);
        }
        throw new Error(`aljazeera: unsupported URL ${url}`);
    }
    async listVideos(url, options = {}) {
        if (!AlJazeeraIE.listUrlSupported(url)) {
            throw new Error("aljazeera: not a listing URL (use https://network.aljazeera.net/en/channels)");
        }
        let channels = await (0, client_1.discoverAjChannels)(this.request);
        if (options.limit && options.limit > 0)
            channels = channels.slice(0, options.limit);
        return {
            extractor: AlJazeeraIE.IE_NAME,
            webpage_url: client_1.AJ_CHANNELS_URL,
            playlist_id: "channels",
            playlist_title: "Al Jazeera channels",
            page: 1,
            entries: channels.map(ch => this.entryFromChannel(ch)),
            next_page_url: null,
        };
    }
    async listCategories(_url = client_1.AJ_CHANNELS_URL, options = {}) {
        let channels = await (0, client_1.discoverAjChannels)(this.request);
        if (options.limit && options.limit > 0)
            channels = channels.slice(0, options.limit);
        return {
            extractor: AlJazeeraIE.IE_NAME,
            webpage_url: client_1.AJ_CHANNELS_URL,
            entries: channels.map(ch => ({
                id: ch.id,
                title: ch.title,
                url: ch.pageUrl,
                display_id: ch.id,
                thumbnail: ch.thumbnail,
            })),
        };
    }
    channelIdFromUrl(url) {
        const page = url.match(CHANNEL_PAGE_URL);
        if (page?.groups?.id)
            return (0, client_1.normalizeAjChannelId)(decodeURIComponent(page.groups.id));
        const pseudo = url.match(PSEUDO_URL);
        if (pseudo?.groups?.id && !isListOnlyPseudo(url)) {
            return (0, client_1.normalizeAjChannelId)(pseudo.groups.id);
        }
        return null;
    }
    entryFromChannel(ch) {
        return {
            id: ch.id,
            url: ch.liveUrl ? `aljazeera:${ch.id}` : ch.pageUrl,
            title: ch.title,
            display_id: ch.id,
            thumbnail: ch.thumbnail,
        };
    }
    titleForChannelId(channelId) {
        const titles = {
            aljazeera: "Al Jazeera Arabic",
            "aljazeera-english": "Al Jazeera English",
            "aljazeera-mubasher": "Al Jazeera Mubasher",
            "aljazeera-documentary": "Al Jazeera Documentary",
        };
        return titles[channelId] || channelId;
    }
    async extractLivePage(liveUrl) {
        const html = await this.request.text(liveUrl, {
            headers: {
                Accept: "text/html,application/xhtml+xml",
                Referer: `${client_1.AJ_NETWORK_ORIGIN}/`,
            },
        });
        const bc = (0, client_1.findBrightcovePlayerUrl)(html);
        if (bc) {
            const info = await this.extractBrightcove(bc, liveUrl);
            info.live_status = "is_live";
            return info;
        }
        const ytId = (0, client_1.findYoutubeVideoId)(html);
        if (ytId) {
            const info = await this.extractYoutube(ytId, liveUrl);
            info.live_status = "is_live";
            return info;
        }
        throw new Error(`aljazeera: no Brightcove/YouTube player found on ${liveUrl}`);
    }
    async extractArticle(pageUrl, displayId, pathType) {
        const { title, video, webpage } = await (0, client_1.fetchAjArticleVideo)(this.request, pageUrl, displayId, pathType);
        let playerUrl = null;
        if (video?.id) {
            playerUrl = (0, client_1.brightcoveUrlFromVideo)(video);
        }
        else if (webpage) {
            playerUrl = (0, client_1.findBrightcovePlayerUrl)(webpage);
        }
        if (!playerUrl) {
            throw new Error(`aljazeera: no Brightcove video on article ${displayId}`);
        }
        const info = await this.extractBrightcove(playerUrl, pageUrl);
        info.display_id = displayId;
        if (title)
            info.title = title;
        return info;
    }
    async extractBrightcove(playerUrl, pageUrl) {
        const ie = new brightcove_1.BrightcoveIE(this.params, this.request);
        const info = await ie.extract(playerUrl);
        info.extractor = AlJazeeraIE.IE_NAME;
        info.extractor_key = AlJazeeraIE.IE_NAME;
        info.webpage_url = pageUrl;
        return info;
    }
    async extractYoutube(videoId, pageUrl) {
        const ie = new video_1.YoutubeIE(this.params, this.request);
        const info = await ie.extract(`https://www.youtube.com/watch?v=${videoId}`);
        info.extractor = AlJazeeraIE.IE_NAME;
        info.extractor_key = AlJazeeraIE.IE_NAME;
        info.webpage_url = pageUrl;
        info.display_id = videoId;
        return info;
    }
}
exports.AlJazeeraIE = AlJazeeraIE;
//# sourceMappingURL=aljazeera.js.map