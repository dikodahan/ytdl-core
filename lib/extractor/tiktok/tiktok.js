"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TiktokIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:www\.)?tiktok\.com\/(?:embed|@(?<user>[\w.-]+)\/video)\/(?<id>\d+)/i;
function collectPlayAddrs(node, out = []) {
    if (!node || typeof node !== "object")
        return out;
    if (Array.isArray(node)) {
        for (const item of node)
            collectPlayAddrs(item, out);
        return out;
    }
    const obj = node;
    const playAddr = obj.playAddr;
    if (typeof playAddr === "string" && playAddr.startsWith("http")) {
        out.push(playAddr);
    }
    else if (playAddr && typeof playAddr === "object") {
        const pa = playAddr;
        for (const u of pa.url_list || pa.UrlList || []) {
            if (typeof u === "string")
                out.push(u);
        }
        if (typeof pa.src === "string")
            out.push(pa.src);
    }
    // downloadAddr often mirrors playAddr
    const downloadAddr = obj.downloadAddr;
    if (typeof downloadAddr === "string" && downloadAddr.startsWith("http")) {
        out.push(downloadAddr);
    }
    for (const v of Object.values(obj)) {
        if (v && typeof v === "object")
            collectPlayAddrs(v, out);
    }
    return out;
}
function findVideoMeta(node) {
    const result = {};
    const walk = (n, depth = 0) => {
        if (!n || typeof n !== "object" || depth > 12)
            return;
        if (Array.isArray(n)) {
            for (const i of n)
                walk(i, depth + 1);
            return;
        }
        const o = n;
        if (typeof o.statusCode === "number")
            result.statusCode = o.statusCode;
        if (typeof o.desc === "string" && !result.title)
            result.title = o.desc;
        if (typeof o.nickname === "string" && !result.author)
            result.author = o.nickname;
        if (typeof o.uniqueId === "string" && !result.author)
            result.author = o.uniqueId;
        const video = o.video;
        if (video) {
            if (typeof video.duration === "number")
                result.duration = video.duration;
            const cover = video.cover || video.originCover || video.dynamicCover;
            if (typeof cover === "string")
                result.cover = cover;
        }
        const author = o.author;
        if (author && typeof author.nickname === "string")
            result.author = author.nickname;
        for (const v of Object.values(o))
            walk(v, depth + 1);
    };
    walk(node);
    return result;
}
class TiktokIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "tiktok";
    static IE_DESC = "TikTok";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — progressive playAddr`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const id = (0, helpers_1.matchId)(url, VALID_URL);
        const webpage = await this.request.text(url, {
            headers: {
                Referer: "https://www.tiktok.com/",
                Accept: "text/html,application/xhtml+xml",
            },
        });
        if (/Please wait|Verify to continue|captcha/i.test(webpage) && webpage.length < 5000) {
            throw new Error("TikTok blocked this request (captcha / bot check). Try cookies via agent or impersonate.");
        }
        let state = (0, helpers_1.tryParseJson)((0, helpers_1.extractBetween)(webpage, 'id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">', "</script>") || "") ||
            (0, helpers_1.tryParseJson)((0, helpers_1.extractBetween)(webpage, 'id="SIGI_STATE" type="application/json">', "</script>") ||
                (0, helpers_1.extractBetween)(webpage, 'id="sigi-persisted-data">', "</script>") ||
                "");
        if (!state) {
            const uni = webpage.match(/<script[^>]+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(\{[\s\S]*?\})<\/script>/);
            if (uni?.[1])
                state = (0, helpers_1.tryParseJson)(uni[1]);
        }
        if (!state) {
            const sigi = webpage.match(/<script[^>]+id="(?:SIGI_STATE|sigi-persisted-data)"[^>]*>(\{[\s\S]*?\})<\/script>/);
            if (sigi?.[1])
                state = (0, helpers_1.tryParseJson)(sigi[1]);
        }
        if (!state) {
            throw new Error("Unable to parse TikTok page state (may be blocked). Try cookies via agent or forceImpersonate.");
        }
        const meta = findVideoMeta(state);
        if (meta.statusCode === 10204) {
            throw new Error("Your IP address is blocked from accessing this TikTok post");
        }
        if (meta.statusCode === 10216 || meta.statusCode === 10222) {
            throw new Error("This TikTok post is private; cookies/login required via agent");
        }
        const addrs = [...new Set(collectPlayAddrs(state))];
        if (!addrs.length) {
            if (/blocked|not available in your|verify/i.test(webpage)) {
                throw new Error("TikTok blocked this request. Try cookies via agent or impersonate.");
            }
            throw new Error(`No playAddr found for TikTok video ${id}`);
        }
        const formats = addrs.map((u, i) => (0, helpers_1.progressiveFormat)(u, {
            format_id: i === 0 ? "play" : `play-${i}`,
            ext: "mp4",
            http_headers: { Referer: "https://www.tiktok.com/" },
        }));
        return (0, helpers_1.baseInfo)("tiktok", url, {
            id,
            title: meta.title || `TikTok ${id}`,
            uploader: meta.author || null,
            duration: meta.duration ?? null,
            thumbnail: meta.cover,
            formats,
        });
    }
}
exports.TiktokIE = TiktokIE;
//# sourceMappingURL=tiktok.js.map