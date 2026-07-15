"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouJizzIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const page_links_1 = require("../_shared/page-links");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:\w+\.)?youjizz\.com\/videos\/(?:[^/#?]*-(?<id>\d+)\.html|embed\/(?<embed_id>\d+))/i;
const LIST_URL_PATTERNS = [
    /^https?:\/\/(?:www\.)?youjizz\.com\/categories\/[^/?#]+\.html/i,
    /^https?:\/\/(?:www\.)?youjizz\.com\/newest-clips\/\d+\.html/i,
];
function absMediaUrl(raw) {
    const url = raw.trim().replace(/\\\//g, "/");
    if (url.startsWith("//"))
        return `https:${url}`;
    return url;
}
function parseEncodings(webpage) {
    const patterns = [
        /dataEncodings\s*=\s*(\[[\s\S]*?\])\s*;/,
        /[Ee]ncodings\s*=\s*(\[[\s\S]*?\])\s*;/,
    ];
    for (const re of patterns) {
        const m = webpage.match(re);
        if (!m?.[1])
            continue;
        const parsed = (0, helpers_1.tryParseJson)(m[1]);
        if (parsed?.length)
            return parsed;
    }
    return [];
}
function encodingsToFormats(encodings) {
    const formats = [];
    const seen = new Set();
    for (const enc of encodings) {
        const raw = enc.filename;
        if (!raw)
            continue;
        const url = absMediaUrl(raw);
        if (seen.has(url))
            continue;
        seen.add(url);
        const formatId = enc.name || (enc.quality != null ? `${enc.quality}p` : "http");
        if (/\.m3u8($|\?)/i.test(url) || /\/_hls\//i.test(url)) {
            formats.push((0, helpers_1.hlsFormat)(url, String(formatId).toLowerCase().replace(/\s+/g, "_")));
        }
        else {
            const height = Number(String(enc.quality || formatId).replace(/\D/g, "")) || null;
            formats.push((0, helpers_1.progressiveFormat)(url, {
                format_id: String(formatId),
                height,
            }));
        }
    }
    return formats;
}
function html5Formats(webpage) {
    const formats = [];
    for (const m of webpage.matchAll(/<(?:video|source)[^>]+src=["']([^"']+)["']/gi)) {
        const url = absMediaUrl(m[1]);
        if (/\.m3u8($|\?)/i.test(url))
            formats.push((0, helpers_1.hlsFormat)(url));
        else
            formats.push((0, helpers_1.progressiveFormat)(url));
    }
    return formats;
}
class YouJizzIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "youjizz";
    static IE_DESC = "YouJizz videos";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — MP4 / HLS from page encodings`,
            validUrl: String(this._VALID_URL),
            options: [],
            notes: "Adult content (18+).",
            listSupported: true,
        };
    }
    static listUrlSupported(url) {
        return LIST_URL_PATTERNS.some(re => re.test(url));
    }
    listingUrl(url, page) {
        if (!page || page <= 1)
            return url;
        return url.replace(/-(\d+)\.html(\?.*)?$/i, `-${page}.html$2`);
    }
    async extract(url) {
        const m = url.match(VALID_URL);
        const videoId = m?.groups?.id || m?.groups?.embed_id;
        if (!videoId)
            throw new Error(`Could not extract id from URL: ${url}`);
        const webpage = await this.request.text(url, {
            headers: { Referer: "https://www.youjizz.com/" },
        });
        let formats = encodingsToFormats(parseEncodings(webpage));
        if (!formats.length)
            formats = html5Formats(webpage);
        if (!formats.length) {
            throw new Error(`youjizz: no playable formats for ${videoId}`);
        }
        const title = webpage.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.replace(/\s*-\s*YouJizz.*$/i, "").trim() ||
            webpage.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1] ||
            videoId;
        const duration = (() => {
            const raw = webpage.match(/<strong>Runtime:<\/strong>\s*([^<]+)/i)?.[1]?.trim() ||
                webpage.match(/property=["']video:duration["'][^>]*content=["'](\d+)/i)?.[1];
            if (!raw)
                return null;
            if (/^\d+$/.test(raw))
                return Number(raw);
            const parts = raw.split(":").map(Number);
            if (parts.length === 3)
                return parts[0] * 3600 + parts[1] * 60 + parts[2];
            if (parts.length === 2)
                return parts[0] * 60 + parts[1];
            return null;
        })();
        const uploader = webpage.match(/<strong>Uploaded By:.*?<a[^>]*>([^<]+)/is)?.[1]?.trim() || undefined;
        return (0, helpers_1.baseInfo)("youjizz", url, {
            id: videoId,
            title,
            duration: Number.isFinite(duration) ? duration : null,
            uploader,
            age_limit: 18,
            formats,
        });
    }
    async listVideos(url, options = {}) {
        if (!YouJizzIE.listUrlSupported(url)) {
            throw new Error(`youjizz: not a listing URL (use /categories/… or /newest-clips/… pages)`);
        }
        const page = options.page && options.page > 0 ? options.page : undefined;
        const fetchUrl = this.listingUrl(url, page);
        const webpage = await this.request.text(fetchUrl, {
            headers: { Referer: "https://www.youjizz.com/" },
        });
        let entries = (0, page_links_1.parseYouJizzEntries)(webpage, fetchUrl);
        if (options.limit && options.limit > 0)
            entries = entries.slice(0, options.limit);
        const playlistTitle = webpage.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.replace(/\s*-\s*YouJizz.*$/i, "").trim() ||
            undefined;
        const pageNum = Number(fetchUrl.match(/-(\d+)\.html/i)?.[1] || "1");
        const playlistId = fetchUrl.replace(/^https?:\/\/[^/]+/i, "").replace(/^\//, "");
        return {
            extractor: YouJizzIE.IE_NAME,
            webpage_url: fetchUrl,
            playlist_id: playlistId,
            playlist_title: playlistTitle,
            page: pageNum,
            entries,
            next_page_url: (0, page_links_1.parseYouJizzNextPage)(webpage, fetchUrl),
        };
    }
}
exports.YouJizzIE = YouJizzIE;
//# sourceMappingURL=youjizz.js.map