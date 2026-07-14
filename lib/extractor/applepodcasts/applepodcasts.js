"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplePodcastsIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/podcasts\.apple\.com\/(?:[^/]+\/)?podcast(?:\/[^/]+){1,2}.*?\bi=(?<id>\d+)/i;
function findEpisodeModel(data) {
    const stack = [data];
    while (stack.length) {
        const cur = stack.pop();
        if (!cur || typeof cur !== "object")
            continue;
        if (Array.isArray(cur)) {
            stack.push(...cur);
            continue;
        }
        const obj = cur;
        if (obj.$kind === "share" && obj.modelType === "EpisodeLockup" && obj.model) {
            return obj.model;
        }
        for (const v of Object.values(obj))
            stack.push(v);
    }
    return null;
}
function stripHtml(html) {
    if (!html)
        return null;
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null;
}
class ApplePodcastsIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "applepodcasts";
    static IE_DESC = "Apple Podcasts episodes";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — progressive audio`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const episodeId = (0, helpers_1.matchId)(url, VALID_URL);
        const webpage = await this.request.text(url);
        const scriptMatch = webpage.match(/<script[^>]*\bid=["']serialized-server-data["'][^>]*>([\s\S]*?)<\/script>/i);
        if (!scriptMatch?.[1]) {
            throw new Error(`Could not find Apple Podcasts serialized-server-data for ${episodeId}`);
        }
        const serverRoot = (0, helpers_1.tryParseJson)(scriptMatch[1]);
        const serverData = serverRoot?.data?.[0]?.data;
        if (!serverData) {
            throw new Error(`Could not parse Apple Podcasts server data for ${episodeId}`);
        }
        const model = findEpisodeModel(serverData);
        const streamUrl = model?.playAction?.episodeOffer?.streamUrl;
        if (!streamUrl) {
            throw new Error(`No streamUrl for Apple Podcasts episode ${episodeId}`);
        }
        const formats = [
            (0, helpers_1.progressiveFormat)(streamUrl, {
                format_id: "http",
                has_video: false,
                vcodec: "none",
            }),
        ];
        const ogThumb = webpage.match(/property="og:image"[^>]+content="([^"]+)"/i)?.[1] ||
            webpage.match(/content="([^"]+)"[^>]+property="og:image"/i)?.[1];
        return (0, helpers_1.baseInfo)("applepodcasts", url, {
            id: episodeId,
            title: model?.title || episodeId,
            description: stripHtml(model?.summary),
            duration: model?.duration ?? null,
            thumbnail: ogThumb,
            formats,
        });
    }
}
exports.ApplePodcastsIE = ApplePodcastsIE;
//# sourceMappingURL=applepodcasts.js.map