"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouPornIE = void 0;
const tough_cookie_1 = require("tough-cookie");
const info_extractor_1 = require("../../core/info-extractor");
const page_links_1 = require("../_shared/page-links");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:www\.)?youporn\.com\/(?:watch|embed)\/(?<id>\d+)(?:\/(?<display_id>[^/?#&]+))?\/?(?:[#?]|$)/i;
const LIST_URL_PATTERNS = [
    /^https?:\/\/(?:www\.)?youporn\.com\/category\/[^/?#&]+(?:\/(?:popular|views|rating|time|duration))?\/?(?:[#?]|$)/i,
    /^https?:\/\/(?:www\.)?youporn\.com\/channel\/[^/?#&]+(?:\/(?:rating|views|duration))?\/?(?:[#?]|$)/i,
    /^https?:\/\/(?:www\.)?youporn\.com\/collections\/videos\/\d+(?:\/(?:rating|views|time|duration))?\/?(?:[#?]|$)/i,
    /^https?:\/\/(?:www\.)?youporn\.com\/porntags\/[^/?#&]+(?:\/(?:views|rating|time|duration))?\/?(?:[#?]|$)/i,
    /^https?:\/\/(?:www\.)?youporn\.com\/pornstar\/[^/?#&]+(?:\/(?:rating|views|duration))?\/?(?:[#?]|$)/i,
    /^https?:\/\/(?:www\.)?youporn\.com\/?(?:[?#]|$)/i,
    /^https?:\/\/(?:www\.)?youporn\.com\/(?:browse\/)?(?:duration|rating|time|views|most_(?:favourit|view)ed|recommended|top_rated)?\/?(?:[#?]|$)/i,
];
class YouPornIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "youporn";
    static IE_DESC = "YouPorn watch / embed videos";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — HLS / progressive via player API`,
            validUrl: String(this._VALID_URL),
            options: [],
            notes: "Requires age-verification cookie; adult content (18+).",
            listSupported: true,
        };
    }
    static listUrlSupported(url) {
        return LIST_URL_PATTERNS.some(re => re.test(url));
    }
    listingUrl(url, page) {
        const u = new URL(url.startsWith("http") ? url : `https://www.youporn.com${url}`);
        if (page && page > 0)
            u.searchParams.set("page", String(page));
        return u.toString();
    }
    setAgeVerifiedCookie() {
        this.request.agent.jar.setCookieSync(new tough_cookie_1.Cookie({
            key: "age_verified",
            value: "1",
            domain: "youporn.com",
            path: "/",
            secure: true,
            httpOnly: false,
        }), "https://www.youporn.com/");
    }
    parsePlayerVars(webpage, videoId) {
        const marker = webpage.indexOf("playervars:");
        if (marker < 0) {
            throw new Error(`youporn: player vars not found for ${videoId}`);
        }
        const brace = webpage.indexOf("{", marker);
        const parsed = (0, helpers_1.extractJsonObject)(webpage, brace);
        if (!parsed || typeof parsed !== "object") {
            throw new Error(`youporn: could not parse player vars for ${videoId}`);
        }
        return parsed;
    }
    async remoteFormats(infoUrl, streamType, referer) {
        try {
            const data = await this.request.json(infoUrl, {
                headers: { Referer: referer },
            });
            const list = Array.isArray(data) ? data : [data];
            return list.filter(entry => entry.format === streamType && entry.videoUrl);
        }
        catch {
            return [];
        }
    }
    buildFormats(entries, streamType) {
        const formats = [];
        for (const entry of entries) {
            const url = entry.videoUrl;
            if (streamType === "hls" || /\.m3u8($|\?)/i.test(url)) {
                const q = entry.quality != null ? String(entry.quality) : "hls";
                formats.push((0, helpers_1.hlsFormat)(url, `${q}p`));
                continue;
            }
            const height = entry.height ||
                Number(String(entry.quality || "").replace(/\D/g, "")) ||
                null;
            const mobj = url.match(/(?<height>\d{3,4})[pP]_(?<bitrate>\d+)[kK]_\d+/);
            const parsedHeight = mobj?.groups?.height ? Number(mobj.groups.height) : height;
            const bitrate = mobj?.groups?.bitrate ? Number(mobj.groups.bitrate) : null;
            formats.push((0, helpers_1.progressiveFormat)(url, {
                format_id: parsedHeight && bitrate ? `${parsedHeight}p-${bitrate}k` : String(entry.quality || "mp4"),
                height: parsedHeight,
                tbr: bitrate,
                filesize: entry.videoSize ?? null,
            }));
        }
        return formats;
    }
    async extract(url) {
        const m = url.match(VALID_URL);
        if (!m?.groups?.id)
            throw new Error(`Could not extract id from URL: ${url}`);
        const videoId = m.groups.id;
        const displayId = m.groups.display_id;
        this.setAgeVerifiedCookie();
        const watchUrl = `https://www.youporn.com/watch/${videoId}`;
        const webpage = await this.request.text(watchUrl, {
            headers: { Referer: "https://www.youporn.com/" },
        });
        if (!/<div[^>]*\bid=["']?watch-container/i.test(webpage)) {
            const msg = webpage.match(/id=["']mainContent["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]?.replace(/<[^>]+>/g, " ").trim() ||
                "Video unavailable";
            throw new Error(`youporn: ${msg}`);
        }
        const playerVars = this.parsePlayerVars(webpage, videoId);
        const definitions = playerVars.mediaDefinitions || [];
        const formats = [];
        for (const def of definitions) {
            if (!def.videoUrl)
                continue;
            const remote = await this.remoteFormats(def.videoUrl, def.format, watchUrl);
            formats.push(...this.buildFormats(remote, def.format));
        }
        if (!formats.length) {
            throw new Error(`youporn: no playable formats for ${videoId}`);
        }
        const title = playerVars.video_title ||
            webpage.match(/class=["']watchVideoTitle[^"']*["'][^>]*>([^<]+)/i)?.[1]?.trim() ||
            webpage.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1] ||
            videoId;
        const durationRaw = playerVars.video_duration ?? playerVars.duration;
        const duration = durationRaw != null && durationRaw !== ""
            ? Number(durationRaw)
            : Number(webpage.match(/property=["']video:duration["'][^>]*content=["'](\d+)/i)?.[1]) || null;
        const thumbnail = playerVars.image_url ||
            webpage.match(/(?:imageurl\s*=|poster\s*:)\s*["']([^"']+)["']/i)?.[1] ||
            webpage.match(/property=["']og:image["'][^>]*content=["']([^"']+)/i)?.[1] ||
            undefined;
        return (0, helpers_1.baseInfo)("youporn", url, {
            id: videoId,
            display_id: displayId,
            title,
            thumbnail,
            duration: Number.isFinite(duration) ? duration : null,
            age_limit: 18,
            formats,
        });
    }
    async listVideos(url, options = {}) {
        if (!YouPornIE.listUrlSupported(url)) {
            throw new Error(`youporn: not a listing URL (use category, channel, tag, browse, etc.)`);
        }
        this.setAgeVerifiedCookie();
        const page = options.page && options.page > 0 ? options.page : undefined;
        const fetchUrl = this.listingUrl(url, page);
        const webpage = await this.request.text(fetchUrl, {
            headers: { Referer: "https://www.youporn.com/" },
        });
        let entries = (0, page_links_1.parseYouPornWatchEntries)(webpage, fetchUrl);
        if (options.limit && options.limit > 0)
            entries = entries.slice(0, options.limit);
        const playlistTitle = webpage.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1] ||
            webpage.match(/<h1[^>]*>([^<]+)/i)?.[1]?.trim() ||
            undefined;
        const path = new URL(fetchUrl).pathname.replace(/^\/+|\/+$/g, "") || "youporn";
        const pageNum = Number(new URL(fetchUrl).searchParams.get("page") || "1");
        return {
            extractor: YouPornIE.IE_NAME,
            webpage_url: fetchUrl,
            playlist_id: page && page > 1 ? `${path}?page=${pageNum}` : path,
            playlist_title: playlistTitle,
            page: pageNum,
            entries,
            next_page_url: (0, page_links_1.parseYouPornNextPage)(webpage, fetchUrl),
        };
    }
}
exports.YouPornIE = YouPornIE;
//# sourceMappingURL=youporn.js.map