"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbcIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
/** Australian ABC News / Listen / BTN pages (upstream ABCIE). */
const VALID_URL = /^https?:\/\/(?:www\.)?abc\.net\.au\/(?:news|btn|listen)\/(?:[^/?#]+\/){1,4}(?<id>\d{5,})/i;
function og(webpage, prop) {
    return (webpage.match(new RegExp(`property=["']og:${prop}["']\\s+content=["']([^"']+)`, "i"))?.[1] ||
        webpage.match(new RegExp(`content=["']([^"']+)["']\\s+property=["']og:${prop}["']`, "i"))?.[1] ||
        null);
}
function unescapeHtml(s) {
    return s
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");
}
class AbcIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "abc";
    static IE_DESC = "ABC Australia (abc.net.au) news / listen / btn";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — progressive / HLS`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const videoId = (0, helpers_1.matchId)(url, VALID_URL);
        const webpage = await this.request.text(url);
        const directAudio = webpage.match(/<a\s+href="(?<url>[^"]+)"\s+data-duration="\d+"\s+title="Download audio directly">/i);
        if (directAudio?.groups?.url) {
            return (0, helpers_1.baseInfo)("abc", url, {
                id: videoId,
                title: og(webpage, "title") || videoId,
                description: og(webpage, "description"),
                thumbnail: og(webpage, "image") || undefined,
                formats: [
                    (0, helpers_1.progressiveFormat)(directAudio.groups.url, {
                        format_id: "audio",
                        has_video: false,
                        vcodec: "none",
                    }),
                ],
            });
        }
        const yt = webpage.match(/<a href="(?<url>https?:\/\/www\.youtube\.com\/watch\?v=[^"]+)"/i) ||
            webpage.match(/<iframe[^>]+src="(?<url>\/\/www\.youtube-nocookie\.com\/embed\/[^?"]+)/i);
        if (yt?.groups?.url) {
            throw new Error(`ABC page ${videoId} only embeds YouTube (${yt.groups.url}); use the youtube extractor`);
        }
        let sources = null;
        const sourcesJson = webpage.match(/"(?:sources|files|renditions)"\s*:\s*(\[[^\]]+\])/i);
        if (sourcesJson?.[1]) {
            sources = (0, helpers_1.tryParseJson)(sourcesJson[1]);
        }
        if (!sources) {
            const push = webpage.match(/inline(?<type>Video|Audio|YouTube)Data\.push\((?<json>[^)]+)\);/i);
            if (push?.groups?.type === "YouTube") {
                throw new Error(`ABC page ${videoId} only embeds YouTube; use the youtube extractor`);
            }
            if (push?.groups?.json) {
                const parsed = (0, helpers_1.tryParseJson)(unescapeHtml(push.groups.json.replace(/'/g, '"')));
                if (parsed)
                    sources = Array.isArray(parsed) ? parsed : [parsed];
            }
        }
        if (!sources?.length) {
            const expired = webpage.match(/class="expired-(?:video|audio)"[\s\S]*?<span>([^<]+)/i)?.[1]?.trim();
            if (expired)
                throw new Error(`abc said: ${expired}`);
            throw new Error(`Unable to extract video urls from ABC page ${videoId}`);
        }
        const formats = [];
        for (const src of sources) {
            if (!src.url)
                continue;
            if (/\.m3u8(\?|$)/i.test(src.url)) {
                formats.push((0, helpers_1.hlsFormat)(src.url));
                continue;
            }
            const isVideo = src.contentType === "video/mp4" ||
                src.MIMEType === "video/mp4" ||
                /\.mp4(\?|$)/i.test(src.url);
            formats.push((0, helpers_1.progressiveFormat)(src.url, {
                format_id: src.label != null ? String(src.label) : undefined,
                width: src.width != null ? Number(src.width) || null : null,
                height: src.height != null ? Number(src.height) || null : null,
                tbr: src.bitrate != null ? Number(src.bitrate) || null : null,
                filesize: src.filesize != null ? Number(src.filesize) || null : null,
                has_video: isVideo,
                vcodec: isVideo ? src.codec || "unknown" : "none",
            }));
        }
        if (!formats.length)
            throw new Error(`ABC page ${videoId} has no playable formats`);
        return (0, helpers_1.baseInfo)("abc", url, {
            id: videoId,
            title: og(webpage, "title") || videoId,
            description: og(webpage, "description"),
            thumbnail: og(webpage, "image") || undefined,
            formats,
        });
    }
}
exports.AbcIE = AbcIE;
//# sourceMappingURL=abc.js.map