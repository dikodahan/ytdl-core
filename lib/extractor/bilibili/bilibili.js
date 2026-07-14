"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BilibiliIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:www\.)?bilibili\.com\/video\/(?<prefix>[aAbB][vV])?(?<id>[^/?#&]+)/i;
const REFERER = "https://www.bilibili.com/";
class BilibiliIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "bilibili";
    static IE_DESC = "Bilibili";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — progressive durl / DASH (A/V may be separate)`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    formatsFromPlayInfo(data) {
        const formats = [];
        for (const d of data.durl || []) {
            if (d.url) {
                formats.push((0, helpers_1.progressiveFormat)(d.url, {
                    format_id: "durl",
                    filesize: d.size ?? null,
                }));
            }
            for (const backup of d.backup_url || []) {
                formats.push((0, helpers_1.progressiveFormat)(backup, { format_id: "durl-backup" }));
            }
        }
        for (const v of data.dash?.video || []) {
            const url = v.baseUrl || v.base_url;
            if (!url)
                continue;
            formats.push((0, helpers_1.progressiveFormat)(url, {
                format_id: `dash-v-${v.id ?? "video"}`,
                width: v.width ?? null,
                height: v.height ?? null,
                tbr: v.bandwidth ? Math.round(v.bandwidth / 1000) : null,
                vcodec: v.codecs || "unknown",
                acodec: "none",
                has_audio: false,
                has_video: true,
                format_note: "video-only (merge with audio for VLC if needed)",
            }));
        }
        for (const a of data.dash?.audio || []) {
            const url = a.baseUrl || a.base_url;
            if (!url)
                continue;
            formats.push((0, helpers_1.progressiveFormat)(url, {
                format_id: `dash-a-${a.id ?? "audio"}`,
                tbr: a.bandwidth ? Math.round(a.bandwidth / 1000) : null,
                vcodec: "none",
                acodec: a.codecs || "unknown",
                has_audio: true,
                has_video: false,
                format_note: "audio-only",
            }));
        }
        return formats;
    }
    async extract(url) {
        const rawId = (0, helpers_1.matchId)(url, VALID_URL);
        const m = url.match(VALID_URL);
        const prefix = (m?.groups?.prefix || (rawId.toUpperCase().startsWith("BV") ? "BV" : "av")).replace(/av/i, "av");
        const isBv = /^bv/i.test(prefix + rawId) || /^BV/i.test(rawId);
        const videoId = isBv
            ? rawId.toUpperCase().startsWith("BV")
                ? rawId
                : `BV${rawId}`
            : rawId.replace(/^av/i, "");
        const pageUrl = isBv
            ? `https://www.bilibili.com/video/${videoId}`
            : `https://www.bilibili.com/video/av${videoId}`;
        const webpage = await this.request.text(pageUrl, {
            headers: { Referer: REFERER },
        });
        const initialState = (0, helpers_1.searchJsonAssignment)(webpage, /window\.__INITIAL_STATE__\s*=/);
        let playInfo = (0, helpers_1.searchJsonAssignment)(webpage, /window\.__playinfo__\s*=/);
        const videoData = initialState?.videoData;
        const bvid = videoData?.bvid || (isBv ? videoId : undefined);
        const aid = videoData?.aid;
        const cid = videoData?.cid || videoData?.pages?.[0]?.cid;
        const id = bvid || (aid != null ? String(aid) : videoId);
        let data = playInfo?.data;
        if (!data?.durl && !data?.dash && cid) {
            const query = {
                cid,
                qn: 80,
                fnval: 4048,
                fourk: 1,
            };
            if (bvid)
                query.bvid = bvid;
            else if (aid)
                query.avid = aid;
            try {
                const api = await this.request.json("https://api.bilibili.com/x/player/playurl", {
                    query,
                    headers: { Referer: REFERER },
                });
                data = api.data;
            }
            catch {
                /* keep page playinfo */
            }
        }
        if (!data) {
            // last resort: parse playinfo from page text
            const mPlay = webpage.match(/window\.__playinfo__\s*=\s*(\{.+?\});/s);
            if (mPlay?.[1]) {
                const parsed = (0, helpers_1.tryParseJson)(mPlay[1]);
                data = parsed?.data;
            }
        }
        if (!data)
            throw new Error(`Unable to get Bilibili playinfo for ${id}`);
        const formats = this.formatsFromPlayInfo(data);
        // Prefer returning both video + audio dash tracks (A/V may be separate; VLC may need merge)
        if (!formats.length)
            throw new Error(`No playable formats for Bilibili ${id}`);
        return (0, helpers_1.baseInfo)("bilibili", url, {
            id,
            title: videoData?.title || id,
            description: videoData?.desc || null,
            duration: videoData?.duration ?? (data.timelength ? data.timelength / 1000 : null),
            uploader: videoData?.owner?.name || null,
            uploader_id: videoData?.owner?.mid != null ? String(videoData.owner.mid) : null,
            thumbnail: videoData?.pic,
            formats,
            http_headers: { Referer: REFERER },
        });
    }
}
exports.BilibiliIE = BilibiliIE;
//# sourceMappingURL=bilibili.js.map