"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReutersIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
/** Upstream ReutersIE uses videoId=; also match modern /video/… paths. */
const VALID_URL = /^https?:\/\/(?:www\.)?reuters\.com\/(?:.*?[?&]videoId=(?<id>\d+)|video\/(?:[^/?#]+\/)*(?<slug>[^/?#]+)|(?:[^/?#]+\/)*video\/(?<slug2>[^/?#]+))/i;
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
        .replace(/\\u0026/g, "&");
}
class ReutersIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "reuters";
    static IE_DESC = "Reuters.com videos";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — HLS / progressive`,
            validUrl: String(this._VALID_URL),
            options: [],
            notes: "Legacy yovideo API may be offline; falls back to page JSON-LD / embedded media URLs.",
        };
    }
    async extractLegacy(videoId, pageUrl) {
        let iframe;
        try {
            iframe = await this.request.text(`https://www.reuters.com/assets/iframe/yovideo?videoId=${videoId}`);
        }
        catch {
            return null;
        }
        const raw = iframe.match(/Reuters\.yovideo\.drawPlayer\((\{[\s\S]*?\})\);/i)?.[1];
        if (!raw)
            return null;
        const title = unescapeHtml(raw.match(/"title"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1] || videoId);
        const thumb = raw.match(/"thumb"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1];
        const seconds = raw.match(/"seconds"\s*:\s*"?(\d+)/)?.[1];
        const flv = raw.match(/"flv"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1];
        if (!flv)
            return null;
        const ids = flv.match(/,\/(\d+)\?f=(\d+)/);
        if (!ids)
            return null;
        let mas = [];
        try {
            const masRaw = await this.request.text(`https://mas-e.cds1.yospace.com/mas/${ids[1]}/${ids[2]}?trans=json`);
            mas = (0, helpers_1.tryParseJson)(masRaw.replace(/'/g, '"')) || [];
        }
        catch {
            return null;
        }
        const formats = [];
        for (const f of mas) {
            if (!f.url)
                continue;
            if (f.method === "hls" || /\.m3u8(\?|$)/i.test(f.url))
                formats.push((0, helpers_1.hlsFormat)(f.url));
            else {
                formats.push((0, helpers_1.progressiveFormat)(f.url, {
                    format_id: f.method || f.container || "http",
                    ext: f.container || undefined,
                }));
            }
        }
        if (!formats.length)
            return null;
        return (0, helpers_1.baseInfo)("reuters", pageUrl, {
            id: videoId,
            title,
            thumbnail: thumb,
            duration: seconds ? Number(seconds) : null,
            formats,
        });
    }
    extractFromWebpage(webpage, url, id) {
        const formats = [];
        const seen = new Set();
        const jsonLdBlocks = [...webpage.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
        for (const block of jsonLdBlocks) {
            const data = (0, helpers_1.tryParseJson)(block[1] || "");
            const nodes = Array.isArray(data) ? data : data ? [data] : [];
            for (const node of nodes) {
                const contentUrl = (typeof node.contentUrl === "string" && node.contentUrl) ||
                    (typeof node.embedUrl === "string" && node.embedUrl) ||
                    null;
                if (contentUrl && !seen.has(contentUrl)) {
                    seen.add(contentUrl);
                    if (/\.m3u8(\?|$)/i.test(contentUrl))
                        formats.push((0, helpers_1.hlsFormat)(contentUrl));
                    else if (/\.(mp4|webm|m4a)(\?|$)/i.test(contentUrl)) {
                        formats.push((0, helpers_1.progressiveFormat)(contentUrl));
                    }
                }
                const encodings = node.encoding;
                if (Array.isArray(encodings)) {
                    for (const enc of encodings) {
                        const u = enc && typeof enc === "object" && "contentUrl" in enc
                            ? String(enc.contentUrl || "")
                            : "";
                        if (!u || seen.has(u))
                            continue;
                        seen.add(u);
                        if (/\.m3u8(\?|$)/i.test(u))
                            formats.push((0, helpers_1.hlsFormat)(u));
                        else if (/^https?:/i.test(u))
                            formats.push((0, helpers_1.progressiveFormat)(u));
                    }
                }
            }
        }
        for (const m of webpage.matchAll(/https?:\/\/[^"'\\\s>]+\.m3u8[^"'\\\s>]*/gi)) {
            const u = unescapeHtml(m[0]);
            if (seen.has(u))
                continue;
            seen.add(u);
            formats.push((0, helpers_1.hlsFormat)(u));
        }
        for (const m of webpage.matchAll(/https?:\/\/[^"'\\\s>]+\.mp4[^"'\\\s>]*/gi)) {
            const u = unescapeHtml(m[0]);
            if (seen.has(u) || /thumbnail|sprite|poster/i.test(u))
                continue;
            seen.add(u);
            formats.push((0, helpers_1.progressiveFormat)(u));
        }
        if (!formats.length) {
            throw new Error(`Reuters video ${id} has no playable HLS/MP4 (legacy yovideo API unavailable)`);
        }
        return (0, helpers_1.baseInfo)("reuters", url, {
            id,
            title: og(webpage, "title") || id,
            description: og(webpage, "description"),
            thumbnail: og(webpage, "image") || undefined,
            formats,
        });
    }
    async extract(url) {
        const m = url.match(VALID_URL);
        const videoId = m?.groups?.id;
        const slug = m?.groups?.slug || m?.groups?.slug2;
        if (!videoId && !slug)
            throw new Error(`Could not extract id from URL: ${url}`);
        if (videoId) {
            const legacy = await this.extractLegacy(videoId, url);
            if (legacy)
                return legacy;
        }
        const webpage = await this.request.text(url);
        const idFromPage = webpage.match(/["']videoId["']\s*:\s*["']?(\d+)/i)?.[1] ||
            webpage.match(/videoId=(\d+)/i)?.[1] ||
            videoId ||
            slug ||
            (0, helpers_1.matchId)(url, VALID_URL);
        return this.extractFromWebpage(webpage, url, idFromPage);
    }
}
exports.ReutersIE = ReutersIE;
//# sourceMappingURL=reuters.js.map