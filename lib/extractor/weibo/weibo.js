"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeiboIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:m\.weibo\.cn\/(?:status|detail)|(?:www\.)?weibo\.com\/\d+)\/(?<id>[a-zA-Z0-9]+)/i;
function stripJsonp(text) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start)
        return text.slice(start, end + 1);
    const a0 = text.indexOf("[");
    const a1 = text.lastIndexOf("]");
    if (a0 >= 0 && a1 > a0)
        return text.slice(a0, a1 + 1);
    return text;
}
class WeiboIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "weibo";
    static IE_DESC = "微博 / Weibo";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — ajax/statuses/show media playback`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async updateVisitorCookies() {
        const headers = { Referer: "https://weibo.com/" };
        const ua = this.request.defaultHeaders["User-Agent"] || "";
        const chromeVer = ua.match(/Chrome\/(\d+)/)?.[1] || "125";
        const genBody = await this.request.text("https://passport.weibo.com/visitor/genvisitor", {
            method: "POST",
            headers: {
                ...headers,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                cb: "gen_callback",
                fp: JSON.stringify({
                    os: "1",
                    browser: `Chrome${chromeVer},0,0,0`,
                    fonts: "undefined",
                    screenInfo: "1920*1080*24",
                    plugins: "",
                }),
            }).toString(),
        });
        const genJson = (0, helpers_1.tryParseJson)(stripJsonp(genBody));
        const tid = genJson?.data?.tid;
        if (!tid)
            throw new Error("weibo: failed to generate guest visitor tid");
        await this.request.text("https://passport.weibo.com/visitor/visitor", {
            headers,
            query: {
                a: "incarnate",
                t: tid,
                w: genJson?.data?.new_tid ? 3 : 2,
                c: String(genJson?.data?.confidence ?? 100).padStart(3, "0"),
                gc: "",
                cb: "cross_domain",
                from: "weibo",
                _rand: Math.random(),
            },
        });
    }
    async downloadStatusJson(videoId) {
        const headers = { Referer: "https://weibo.com/" };
        const fetchOnce = async () => this.request.request("https://weibo.com/ajax/statuses/show", {
            headers,
            query: { id: videoId },
        });
        let res = await fetchOnce();
        let parsed = (0, helpers_1.tryParseJson)(res.body);
        if (!parsed || /passport\.weibo\.com/i.test(res.body) || res.statusCode === 432) {
            await this.updateVisitorCookies();
            res = await fetchOnce();
            parsed = (0, helpers_1.tryParseJson)(res.body);
        }
        if (!parsed) {
            throw new Error(`weibo: failed to load status ${videoId} (login/guest visitor cookies may be required)`);
        }
        return parsed;
    }
    formatsFromMedia(media) {
        if (!media)
            return [];
        const formats = [];
        for (const item of media.playback_list || []) {
            const play = item.play_info;
            if (!play?.url)
                continue;
            const formatId = play.label || play.quality_desc || "http";
            if (/\.m3u8/i.test(play.url)) {
                formats.push({
                    ...(0, helpers_1.hlsFormat)(play.url, formatId),
                    width: play.width ?? null,
                    height: play.height ?? null,
                    tbr: play.bitrate ?? null,
                    filesize: play.size ?? null,
                    vcodec: play.video_codecs || "unknown",
                    acodec: play.audio_codecs || "unknown",
                });
            }
            else {
                formats.push((0, helpers_1.progressiveFormat)(play.url, {
                    format_id: formatId,
                    width: play.width ?? null,
                    height: play.height ?? null,
                    filesize: play.size ?? null,
                    vcodec: play.video_codecs || "unknown",
                    acodec: play.audio_codecs || "unknown",
                }));
            }
        }
        if (!formats.length) {
            const fallbackKeys = ["stream_url_hd", "stream_url", "mp4_hd_url", "mp4_sd_url"];
            for (const key of fallbackKeys) {
                const u = media[key];
                if (typeof u === "string" && /^https?:\/\//i.test(u)) {
                    formats.push(/\.m3u8/i.test(u)
                        ? (0, helpers_1.hlsFormat)(u, key)
                        : (0, helpers_1.progressiveFormat)(u, { format_id: key }));
                }
            }
        }
        return formats;
    }
    parseVideoInfo(meta, pageUrl) {
        const media = meta.page_info?.media_info;
        const formats = this.formatsFromMedia(media);
        if (!formats.length) {
            throw new Error(`weibo: no playable media_info urls for ${meta.id_str || meta.id || meta.mid}`);
        }
        const id = String(meta.id_str || meta.id || meta.mid || "");
        const title = media?.video_title || media?.kol_title || media?.name || meta.text_raw || id;
        return (0, helpers_1.baseInfo)("weibo", pageUrl, {
            id,
            title: title.replace(/\n/g, " ").slice(0, 200),
            description: meta.text_raw || meta.text || null,
            duration: media?.duration ?? null,
            uploader: meta.user?.screen_name || null,
            uploader_id: meta.user?.id_str || (meta.user?.id != null ? String(meta.user.id) : null),
            thumbnail: meta.page_info?.page_pic,
            formats,
            http_headers: { Referer: "https://weibo.com/" },
        });
    }
    async extract(url) {
        const videoId = (0, helpers_1.matchId)(url, VALID_URL);
        const meta = await this.downloadStatusJson(videoId);
        const mixItems = meta.mix_media_info?.items?.filter(i => i.type !== "pic") || [];
        if (mixItems.length > 1) {
            // Prefer first video item for VLC single-info path
            const first = mixItems[0];
            const synthetic = {
                id: first.data?.object_id,
                id_str: first.data?.object_id,
                page_info: { media_info: first.data?.media_info },
                user: meta.user,
                text_raw: meta.text_raw,
            };
            return this.parseVideoInfo(synthetic, url);
        }
        if (mixItems.length === 1) {
            const item = mixItems[0];
            return this.parseVideoInfo({
                id: item.data?.object_id || meta.id,
                id_str: item.data?.object_id || meta.id_str,
                page_info: { media_info: item.data?.media_info },
                user: meta.user,
                text_raw: meta.text_raw,
            }, url);
        }
        return this.parseVideoInfo(meta, url);
    }
}
exports.WeiboIE = WeiboIE;
//# sourceMappingURL=weibo.js.map