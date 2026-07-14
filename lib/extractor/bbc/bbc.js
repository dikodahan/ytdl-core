"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BbcIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const PID = "(?:[pbml][\\da-z]{7}|w[\\da-z]{7,14})";
const VALID_URL = new RegExp(`^https?:\\/\\/(?:www\\.)?(?:bbc\\.(?:com|co\\.uk)|bbcnewsd73hkzno2ini43t4gblxvycyac5aw4gnv7t2rccijh7745uqd\\.onion|bbcweb3hytmzhn5d532owbu6oqadra5z3ar726vq5kgwwn6aucdccrad\\.onion)/(?:[^/]+/)+(?<id>[^/#?]+)`, "i");
const MEDIA_SETS = ["iptv-all", "pc", "mobile-tablet-main"];
const MEDIA_SELECTOR = "https://open.live.bbc.co.uk/mediaselector/6/select/version/2.0/mediaset/%s/vpid/%s";
function og(webpage, prop) {
    return (webpage.match(new RegExp(`property=["']og:${prop}["']\\s+content=["']([^"']+)`, "i"))?.[1] ||
        webpage.match(new RegExp(`content=["']([^"']+)["']\\s+property=["']og:${prop}["']`, "i"))?.[1] ||
        null);
}
function unescapeHtml(s) {
    return s
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
}
class BbcIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "bbc";
    static IE_DESC = "BBC / BBC iPlayer";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — HLS via media selector`,
            validUrl: String(this._VALID_URL),
            options: [],
            notes: "Often geo-restricted to the UK.",
        };
    }
    async downloadMediaSelector(vpid) {
        let lastGeo = null;
        const formats = [];
        const seen = new Set();
        for (const mediaSet of MEDIA_SETS) {
            const url = MEDIA_SELECTOR.replace("%s", mediaSet).replace("%s", vpid);
            let selection;
            try {
                const res = await this.request.request(url);
                selection = (0, helpers_1.tryParseJson)(res.body) || {};
                if (res.statusCode >= 400 && !selection.result) {
                    throw new Error(`HTTP ${res.statusCode}`);
                }
            }
            catch {
                continue;
            }
            if (selection.result) {
                if (selection.result === "notukerror" ||
                    selection.result === "geolocation" ||
                    selection.result === "selectionunavailable") {
                    lastGeo = selection.result;
                    continue;
                }
                throw new Error(`bbc returned error: ${selection.result}`);
            }
            for (const media of selection.media || []) {
                if (media.kind !== "video" && media.kind !== "audio")
                    continue;
                for (const conn of media.connection || []) {
                    const href = conn.href;
                    if (!href || seen.has(href))
                        continue;
                    seen.add(href);
                    if (conn.transferFormat === "hls" || /\.m3u8(\?|$)/i.test(href)) {
                        formats.push((0, helpers_1.hlsFormat)(href, `hls-${conn.supplier || mediaSet}`));
                    }
                    else if (/^https?:/i.test(href) && !/\.f4m(\?|$)/i.test(href)) {
                        formats.push((0, helpers_1.progressiveFormat)(href, {
                            format_id: conn.supplier || media.encoding || "http",
                            width: media.width != null ? Number(media.width) || null : null,
                            height: media.height != null ? Number(media.height) || null : null,
                            tbr: media.bitrate != null ? Number(media.bitrate) || null : null,
                            has_video: media.kind === "video",
                            vcodec: media.kind === "audio" ? "none" : "unknown",
                        }));
                    }
                }
            }
            if (formats.length)
                break;
        }
        if (!formats.length) {
            if (lastGeo) {
                throw new Error(`bbc media ${vpid} is geo-restricted (UK only); media selector: ${lastGeo}`);
            }
            throw new Error(`bbc media ${vpid} has no playable HLS/progressive sources`);
        }
        return formats;
    }
    findVpid(webpage) {
        const pidRe = new RegExp(`(?<id>${PID})`);
        const playable = webpage.match(/data-playable=(["'])([\s\S]*?)\1/i);
        if (playable?.[2]) {
            const data = (0, helpers_1.tryParseJson)(unescapeHtml(playable[2]));
            const vpid = data?.settings?.playlistObject?.items?.[0]?.vpid;
            if (vpid && pidRe.test(vpid))
                return vpid;
        }
        const patterns = [
            /"vpid"\s*:\s*"([^"]+)"/i,
            /data-(?:video-player|media)-vpid=["']([^"']+)/i,
            /"versionID"\s*:\s*"([^"]+)"/i,
            /mediator\.bind\(\{[\s\S]*?"vpid"\s*:\s*"([^"]+)"/i,
        ];
        for (const re of patterns) {
            const m = webpage.match(re);
            if (m?.[1] && new RegExp(`^${PID}$`).test(m[1]))
                return m[1];
        }
        const pathPid = webpage.match(new RegExp(`/(?:iplayer/(?:episode|playlist)|programmes)/(${PID})`, "i"));
        return pathPid?.[1] || null;
    }
    async extract(url) {
        const displayId = url.match(VALID_URL)?.groups?.id;
        if (!displayId)
            throw new Error(`Could not extract id from URL: ${url}`);
        const webpage = await this.request.text(url);
        const err = webpage.match(/<div\b[^>]+\bclass=["'](?:smp|playout)__message[^"']*["'][^>]*>\s*([^<]+)/i)?.[1]?.trim();
        if (err)
            throw new Error(err);
        let vpid = this.findVpid(webpage);
        const urlPid = url.match(new RegExp(`\\/(?:episode|programmes)\\/(${PID})`, "i"))?.[1];
        if (!vpid && urlPid)
            vpid = urlPid;
        if (!vpid)
            throw new Error(`Could not find BBC video id (vpid) on ${displayId}`);
        const formats = await this.downloadMediaSelector(vpid);
        const title = og(webpage, "title")?.replace(/\s*-\s*BBC.*$/i, "").trim() ||
            webpage.match(/<h1[^>]*>([^<]+)/i)?.[1]?.trim() ||
            vpid;
        return (0, helpers_1.baseInfo)("bbc", url, {
            id: vpid,
            display_id: displayId,
            title,
            description: og(webpage, "description"),
            thumbnail: og(webpage, "image") || undefined,
            formats,
        });
    }
}
exports.BbcIE = BbcIE;
//# sourceMappingURL=bbc.js.map