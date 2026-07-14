"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacebookIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:[\w-]+\.)?facebook\.com\/(?:(?:watch\/?\?(?:.*&)?v=)|(?:[^/]+\/videos\/(?:[^/]+\/)?)|(?:video\.php\?(?:.*&)?v=)|(?:reel\/)|(?:story\.php\?(?:.*&)?story_fbid=))(?<id>pfbid[A-Za-z0-9]+|\d+)/i;
const PLAYABLE_KEYS = [
    "browser_native_hd_url",
    "browser_native_sd_url",
    "playable_url_quality_hd",
    "playable_url",
    "playable_url_dash",
];
function unescapeJsonUrl(s) {
    return s
        .replace(/\\u0025/g, "%")
        .replace(/\\u0026/g, "&")
        .replace(/\\u002F/gi, "/")
        .replace(/\\\//g, "/")
        .replace(/\\"/g, '"')
        .replace(/&amp;/g, "&");
}
class FacebookIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "facebook";
    static IE_DESC = "Facebook videos";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — progressive playable_url scrape`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const id = (0, helpers_1.matchId)(url, VALID_URL);
        const webpage = await this.request.text(url, {
            headers: {
                Accept: "text/html,application/xhtml+xml",
                Referer: "https://www.facebook.com/",
            },
        });
        const formats = [];
        const seen = new Set();
        for (const key of PLAYABLE_KEYS) {
            const re = new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, "g");
            let m;
            while ((m = re.exec(webpage))) {
                const mediaUrl = unescapeJsonUrl(m[1]);
                if (!mediaUrl.startsWith("http") || seen.has(mediaUrl))
                    continue;
                seen.add(mediaUrl);
                if (/\.mpd(\?|$)/i.test(mediaUrl) || key.includes("dash")) {
                    formats.push((0, helpers_1.dashFormat)(mediaUrl, key.replace(/_/g, "-")));
                }
                else {
                    formats.push((0, helpers_1.progressiveFormat)(mediaUrl, {
                        format_id: key.replace(/_/g, "-"),
                        ext: "mp4",
                    }));
                }
            }
        }
        // Also catch sd_src / hd_src style
        for (const key of ["hd_src", "sd_src", "hd_src_no_ratelimit", "sd_src_no_ratelimit"]) {
            const re = new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, "g");
            let m;
            while ((m = re.exec(webpage))) {
                const mediaUrl = unescapeJsonUrl(m[1]);
                if (!mediaUrl.startsWith("http") || seen.has(mediaUrl))
                    continue;
                seen.add(mediaUrl);
                formats.push((0, helpers_1.progressiveFormat)(mediaUrl, {
                    format_id: key.replace(/_/g, "-"),
                    ext: "mp4",
                }));
            }
        }
        if (!formats.length) {
            throw new Error(`No playable Facebook URLs found for ${id}. The video may require login cookies via agent.`);
        }
        const title = webpage.match(/property="og:title"\s+content="([^"]+)"/i)?.[1] ||
            webpage.match(/<title>([^<]+)<\/title>/i)?.[1]?.replace(/\s*\|\s*Facebook.*$/i, "") ||
            `Facebook ${id}`;
        const thumb = webpage.match(/property="og:image"\s+content="([^"]+)"/i)?.[1] || undefined;
        return (0, helpers_1.baseInfo)("facebook", url, {
            id,
            title: title.replace(/&amp;/g, "&"),
            thumbnail: thumb,
            formats,
        });
    }
}
exports.FacebookIE = FacebookIE;
//# sourceMappingURL=facebook.js.map