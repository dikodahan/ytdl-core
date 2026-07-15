"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XnxxIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const page_links_1 = require("../_shared/page-links");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:video|www)\.xnxx3?\.com\/video-?(?<id>[0-9a-z]+)\//i;
const LIST_URL_PATTERNS = [
    /^https?:\/\/(?:www\.)?xnxx3?\.com\/search\/[^/?#]+(?:\/\d+)?\/?(?:[?#]|$)/i,
    /^https?:\/\/(?:www\.)?xnxx3?\.com\/(?:best|hits|todays-selection|your-suggestions)\/?(?:\d+)?\/?(?:[?#]|$)/i,
    /^https?:\/\/(?:www\.)?xnxx3?\.com\/porn-maker\/[^/?#]+(?:\/\d+)?\/?(?:[?#]|$)/i,
    /^https?:\/\/(?:www\.)?xnxx3?\.com\/?(?:[?#]|$)/i,
];
const CATEGORY_INDEX_URLS = ["https://www.xnxx.com/", "https://www.xnxx.com/tags/a"];
function absMediaUrl(raw) {
    const url = raw.trim();
    if (url.startsWith("//"))
        return `https:${url}`;
    return url;
}
function searchSetVideo(webpage, meta, fatal = true) {
    const re = new RegExp(`set${meta}\\s*\\(\\s*(["'])(?<value>(?:(?!\\1).)+)\\1`);
    const m = webpage.match(re);
    if (m?.groups?.value)
        return m.groups.value;
    if (fatal)
        throw new Error(`xnxx: missing set${meta} on page`);
    return null;
}
function parseThumbnailUrls(webpage) {
    const urls = [];
    const seen = new Set();
    for (const m of webpage.matchAll(/setThumb(?:Url169|Url|SlideBig|Slide)\s*\(\s*(["'])(?<url>(?:https?:)?\/\/(?:(?!\1).)+)\1/gi)) {
        const raw = m.groups?.url;
        if (!raw || /mozaiquemin_NUM/i.test(raw))
            continue;
        const url = absMediaUrl(raw);
        if (seen.has(url))
            continue;
        seen.add(url);
        urls.push(url);
    }
    return urls;
}
function parseFormats(webpage) {
    const formats = [];
    const seen = new Set();
    for (const m of webpage.matchAll(/setVideo(?:Url(?<id>Low|High)|HLS)\s*\(\s*(["'])(?<url>(?:https?:)?\/\/(?:(?!\1).)+)\1/gi)) {
        const rawUrl = m.groups?.url;
        if (!rawUrl)
            continue;
        const url = absMediaUrl(rawUrl);
        if (seen.has(url))
            continue;
        seen.add(url);
        if (/\.m3u8($|\?)/i.test(url)) {
            formats.push((0, helpers_1.hlsFormat)(url));
            continue;
        }
        const formatId = m.groups?.id?.toLowerCase() || "http";
        formats.push((0, helpers_1.progressiveFormat)(url, {
            format_id: formatId,
            height: formatId === "high" ? 360 : formatId === "low" ? 240 : null,
        }));
    }
    return formats;
}
class XnxxIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "xnxx";
    static IE_DESC = "XNXX videos";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — MP4 / HLS from html5player vars`,
            validUrl: String(this._VALID_URL),
            options: [],
            notes: "Adult content (18+).",
            listSupported: true,
        };
    }
    static listUrlSupported(url) {
        if (VALID_URL.test(url))
            return false;
        return LIST_URL_PATTERNS.some(re => re.test(url));
    }
    listingBasePath(url) {
        const parsed = new URL(url);
        let path = parsed.pathname.replace(/\/+$/, "") || "/";
        if (/^\/search\/[^/]+/.test(path)) {
            path = path.replace(/\/\d+$/, "");
        }
        else if (/^\/(?:best|hits|todays-selection|your-suggestions|porn-maker\/[^/]+)/.test(path)) {
            path = path.replace(/\/\d+$/, "");
        }
        return path;
    }
    listingUrl(url, page) {
        const parsed = new URL(url);
        const basePath = this.listingBasePath(url);
        if (!page || page <= 1) {
            return `${parsed.origin}${basePath === "/" ? "/" : `${basePath}/`}`;
        }
        return `${parsed.origin}${basePath}/${page - 1}/`;
    }
    pageNumberFromUrl(url) {
        const path = new URL(url).pathname.replace(/\/+$/, "");
        const m = path.match(/\/(\d+)$/);
        return m?.[1] ? Number(m[1]) + 1 : 1;
    }
    async extract(url) {
        const m = url.match(VALID_URL);
        if (!m?.groups?.id)
            throw new Error(`Could not extract id from URL: ${url}`);
        const videoId = m.groups.id;
        const webpage = await this.request.text(url, {
            headers: { Referer: "https://www.xnxx.com/" },
        });
        const formats = parseFormats(webpage);
        if (!formats.length) {
            throw new Error(`xnxx: no playable formats for ${videoId}`);
        }
        const title = webpage.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1]?.trim() ||
            searchSetVideo(webpage, "VideoTitle") ||
            videoId;
        const thumbnail = webpage.match(/property=["']og:image["'][^>]*content=["']([^"']+)/i)?.[1] ||
            searchSetVideo(webpage, "ThumbUrl", false) ||
            searchSetVideo(webpage, "ThumbUrl169", false) ||
            undefined;
        const thumbUrls = parseThumbnailUrls(webpage);
        const thumbnails = thumbUrls.length > 0
            ? thumbUrls.map(url => ({ url }))
            : thumbnail
                ? [{ url: thumbnail }]
                : undefined;
        const durationRaw = webpage.match(/property=["']video:duration["'][^>]*content=["'](\d+)/i)?.[1];
        const duration = durationRaw ? Number(durationRaw) : null;
        const viewRaw = webpage.match(/id=["']nb-views-number[^>]+>([\d,.]+)/i)?.[1];
        const viewCount = viewRaw ? Number(viewRaw.replace(/,/g, "")) : null;
        return (0, helpers_1.baseInfo)("xnxx", url, {
            id: videoId,
            title,
            thumbnail: thumbnail || thumbUrls[0],
            thumbnails,
            duration: Number.isFinite(duration) ? duration : null,
            view_count: Number.isFinite(viewCount) ? viewCount : null,
            age_limit: 18,
            formats,
        });
    }
    async listVideos(url, options = {}) {
        if (!XnxxIE.listUrlSupported(url)) {
            throw new Error(`xnxx: not a listing URL (use /search/…, /best/, homepage, etc.)`);
        }
        const page = options.page && options.page > 0 ? options.page : undefined;
        const fetchUrl = this.listingUrl(url, page);
        const webpage = await this.request.text(fetchUrl, {
            headers: { Referer: "https://www.xnxx.com/" },
        });
        let entries = (0, page_links_1.parseXnxxEntries)(webpage, fetchUrl);
        if (options.limit && options.limit > 0)
            entries = entries.slice(0, options.limit);
        const playlistTitle = webpage.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1]?.trim() ||
            webpage.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.replace(/\s*-\s*XNXX\.COM.*$/i, "").trim() ||
            undefined;
        const basePath = this.listingBasePath(fetchUrl).replace(/^\/+|\/+$/g, "") || "xnxx";
        const pageNum = this.pageNumberFromUrl(fetchUrl);
        return {
            extractor: XnxxIE.IE_NAME,
            webpage_url: fetchUrl,
            playlist_id: page && page > 1 ? `${basePath}/${pageNum - 1}` : basePath,
            playlist_title: playlistTitle,
            page: pageNum,
            entries,
            next_page_url: (0, page_links_1.parseXnxxNextPage)(webpage, fetchUrl),
        };
    }
    async listCategories(url = "https://www.xnxx.com/", options = {}) {
        const normalized = url.replace(/\/+$/, "") || "https://www.xnxx.com";
        const targets = normalized === "https://www.xnxx.com" || normalized.endsWith("/tags")
            ? CATEGORY_INDEX_URLS
            : [normalized];
        let lastError = "no categories found";
        for (const indexUrl of targets) {
            try {
                const webpage = await this.request.text(indexUrl, {
                    headers: { Referer: "https://www.xnxx.com/" },
                });
                let entries = (0, page_links_1.parseXnxxCategories)(webpage, indexUrl);
                if (!entries.length) {
                    lastError = `no categories found at ${indexUrl}`;
                    continue;
                }
                if (options.limit && options.limit > 0) {
                    entries = entries.slice(0, options.limit);
                }
                return {
                    extractor: XnxxIE.IE_NAME,
                    webpage_url: indexUrl,
                    entries,
                };
            }
            catch (err) {
                lastError = err instanceof Error ? err.message : String(err);
            }
        }
        throw new Error(`xnxx: ${lastError}`);
    }
}
exports.XnxxIE = XnxxIE;
//# sourceMappingURL=xnxx.js.map