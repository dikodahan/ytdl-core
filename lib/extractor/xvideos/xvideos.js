"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XVideosIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const page_links_1 = require("../_shared/page-links");
const helpers_1 = require("../_shared/helpers");
/** Watch / embed URLs (`/video.{id}/…`, legacy `/video{id}/…`, `/embedframe/{id}`). */
const VALID_URL = /^https?:\/\/(?:[\w-]+\.)?xvideos2?\.com\/(?:video\.(?<id>[0-9a-z]+)|video(?<legacy_id>\d+)|embedframe\/(?<embed_id>[0-9a-z]+))\b/i;
const LIST_URL_PATTERNS = [
    /^https?:\/\/(?:[\w-]+\.)?xvideos2?\.com\/c\/[A-Za-z0-9_]+-\d+(?:\/\d+)?\/?(?:[?#]|$)/i,
    /^https?:\/\/(?:[\w-]+\.)?xvideos2?\.com\/?(?:[?#]|$)/i,
];
const CATEGORY_INDEX_URLS = ["https://www.xvideos.com/", "https://www.xvideos.com/tags"];
const DEFAULT_HEADERS = {
    Referer: "https://www.xvideos.com/",
    "Accept-Language": "en-US,en;q=0.9",
};
function absMediaUrl(raw) {
    const url = raw.trim().replace(/\\\//g, "/");
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
        throw new Error(`xvideos: missing set${meta} on page`);
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
    for (const m of webpage.matchAll(/setVideo(?:Url(?<id>Low|High)|HLS)\s*\(\s*(?<q>["'])(?<url>(?:https?:)?\/\/(?:(?!\k<q>).)+)\k<q>/gi)) {
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
function videoIdFromMatch(m) {
    return m.groups?.id || m.groups?.legacy_id || m.groups?.embed_id || null;
}
class XVideosIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "xvideos";
    static IE_DESC = "XVideos";
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
        if (/^\/c\/[A-Za-z0-9_]+-\d+/i.test(path)) {
            path = path.replace(/\/\d+$/, "");
        }
        return path;
    }
    listingUrl(url, page) {
        const parsed = new URL(url);
        const basePath = this.listingBasePath(url);
        if (!page || page <= 1) {
            return `${parsed.origin}${basePath === "/" ? "/" : basePath}`;
        }
        // XVideos category pagination: page 2 => `/c/Slug-id/1`
        return `${parsed.origin}${basePath}/${page - 1}`;
    }
    pageNumberFromUrl(url) {
        const path = new URL(url).pathname.replace(/\/+$/, "");
        if (/^\/c\/[A-Za-z0-9_]+-\d+\/(\d+)$/i.test(path)) {
            const m = path.match(/\/(\d+)$/);
            return m?.[1] ? Number(m[1]) + 1 : 1;
        }
        return 1;
    }
    async extract(url) {
        const m = url.match(VALID_URL);
        const videoId = m ? videoIdFromMatch(m) : null;
        if (!videoId)
            throw new Error(`Could not extract id from URL: ${url}`);
        const webpage = await this.request.text(url, { headers: DEFAULT_HEADERS });
        const formats = parseFormats(webpage);
        if (!formats.length) {
            throw new Error(`xvideos: no playable formats for ${videoId}`);
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
            ? thumbUrls.map(u => ({ url: u }))
            : thumbnail
                ? [{ url: thumbnail }]
                : undefined;
        const durationRaw = webpage.match(/property=["']video:duration["'][^>]*content=["'](\d+)/i)?.[1] ||
            webpage.match(/setVideoDuration\s*\(\s*['"]?(\d+)/i)?.[1];
        const duration = durationRaw ? Number(durationRaw) : null;
        const viewRaw = webpage.match(/id=["']nb-views-number[^>]*>([\d,.]+)/i)?.[1];
        const viewCount = viewRaw ? Number(viewRaw.replace(/,/g, "")) : null;
        return (0, helpers_1.baseInfo)(XVideosIE.IE_NAME, url, {
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
        if (!XVideosIE.listUrlSupported(url)) {
            throw new Error(`xvideos: not a listing URL (use /c/{Category}-{id} or homepage)`);
        }
        const page = options.page && options.page > 0 ? options.page : undefined;
        const fetchUrl = this.listingUrl(url, page);
        const webpage = await this.request.text(fetchUrl, { headers: DEFAULT_HEADERS });
        let entries = (0, page_links_1.parseXvideosEntries)(webpage, fetchUrl);
        if (options.limit && options.limit > 0)
            entries = entries.slice(0, options.limit);
        const playlistTitle = webpage.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1]?.trim() ||
            webpage
                .match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
                ?.replace(/\s*-\s*XVIDEOS\.COM.*$/i, "")
                .trim() ||
            undefined;
        const basePath = this.listingBasePath(fetchUrl).replace(/^\/+|\/+$/g, "") || "xvideos";
        const pageNum = this.pageNumberFromUrl(fetchUrl);
        return {
            extractor: XVideosIE.IE_NAME,
            webpage_url: fetchUrl,
            playlist_id: page && page > 1 ? `${basePath}/${pageNum - 1}` : basePath,
            playlist_title: playlistTitle,
            page: pageNum,
            entries,
            next_page_url: (0, page_links_1.parseXvideosNextPage)(webpage, fetchUrl),
        };
    }
    async listCategories(url = "https://www.xvideos.com/", options = {}) {
        const normalized = url.replace(/\/+$/, "") || "https://www.xvideos.com";
        const targets = normalized === "https://www.xvideos.com" ||
            normalized === "https://www.xvideos.com/tags" ||
            /xvideos2?\.com\/?$/i.test(normalized)
            ? CATEGORY_INDEX_URLS
            : [normalized];
        let lastError = "no categories found";
        for (const indexUrl of targets) {
            try {
                const webpage = await this.request.text(indexUrl, { headers: DEFAULT_HEADERS });
                let entries = (0, page_links_1.parseXvideosCategories)(webpage, indexUrl);
                if (!entries.length) {
                    lastError = `no categories found at ${indexUrl}`;
                    continue;
                }
                if (options.limit && options.limit > 0) {
                    entries = entries.slice(0, options.limit);
                }
                return {
                    extractor: XVideosIE.IE_NAME,
                    webpage_url: indexUrl,
                    entries,
                };
            }
            catch (err) {
                lastError = err instanceof Error ? err.message : String(err);
            }
        }
        throw new Error(`xvideos: ${lastError}`);
    }
}
exports.XVideosIE = XVideosIE;
//# sourceMappingURL=xvideos.js.map