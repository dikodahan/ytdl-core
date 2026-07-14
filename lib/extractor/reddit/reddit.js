"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedditIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:\w+\.)?reddit(?:media)?\.com\/(?:(?:r|user)\/[^/]+\/)?comments\/(?<id>[^/?#&]+)/i;
class RedditIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "reddit";
    static IE_DESC = "Reddit videos";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — HLS / progressive fallback`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const id = (0, helpers_1.matchId)(url, VALID_URL);
        const clean = url.split("#")[0].replace(/\?.*$/, "");
        const jsonUrl = clean.replace(/\/?$/, "/") + ".json";
        const payload = await this.request.json(jsonUrl, {
            headers: { Accept: "application/json" },
        });
        const post = payload?.[0]?.data?.children?.[0]?.data;
        if (!post)
            throw new Error(`Reddit post not found: ${id}`);
        const candidates = [
            post.secure_media?.reddit_video,
            post.media?.reddit_video,
            ...(post.crosspost_parent_list || []).flatMap(p => [
                p.secure_media?.reddit_video,
                p.media?.reddit_video,
            ]),
        ];
        const redditVideo = candidates.find(v => v && (v.hls_url || v.fallback_url));
        if (!redditVideo) {
            throw new Error(`No reddit_video media on post ${id}`);
        }
        const formats = [];
        if (redditVideo.hls_url) {
            formats.push((0, helpers_1.hlsFormat)(unescape(redditVideo.hls_url), "hls"));
        }
        if (redditVideo.dash_url) {
            formats.push((0, helpers_1.dashFormat)(unescape(redditVideo.dash_url), "dash"));
        }
        if (redditVideo.fallback_url) {
            formats.push((0, helpers_1.progressiveFormat)(unescape(redditVideo.fallback_url), {
                format_id: "fallback",
                width: redditVideo.width ?? null,
                height: redditVideo.height ?? null,
                tbr: redditVideo.bitrate_kbps ?? null,
            }));
        }
        if (!formats.length)
            throw new Error(`No playable formats for Reddit post ${id}`);
        const mediaId = redditVideo.fallback_url?.match(/v\.redd\.it\/([^/?#&]+)/)?.[1] || id;
        return (0, helpers_1.baseInfo)("reddit", url, {
            id: mediaId,
            display_id: id,
            title: post.title || id,
            uploader: post.author || null,
            thumbnail: post.thumbnail && post.thumbnail.startsWith("http") ? post.thumbnail : undefined,
            duration: redditVideo.duration ?? null,
            formats,
        });
    }
}
exports.RedditIE = RedditIE;
function unescape(s) {
    return s
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"');
}
//# sourceMappingURL=reddit.js.map