"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedGifsIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /https?:\/\/(?:(?:www\.)?redgifs\.com\/(?:watch|ifr)\/|thumbs2\.redgifs\.com\/)(?<id>[^-/?#.]+)/i;
const FORMAT_HEIGHT = {
    gif: 250,
    sd: 480,
    hd: null,
};
class RedGifsIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "redgifs";
    static IE_DESC = "RedGifs";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — progressive mp4`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async fetchToken(videoId) {
        const auth = await this.request.json("https://api.redgifs.com/v2/auth/temporary");
        if (!auth.token)
            throw new Error(`Unable to get RedGifs token for ${videoId}`);
        return auth.token;
    }
    async callApi(ep, videoId, token) {
        return this.request.json(`https://api.redgifs.com/v2/${ep}`, {
            headers: {
                authorization: `Bearer ${token}`,
                referer: "https://www.redgifs.com/",
                origin: "https://www.redgifs.com",
                "content-type": "application/json",
                "x-customheader": `https://www.redgifs.com/watch/${videoId}`,
            },
        });
    }
    async extract(url) {
        const videoId = (0, helpers_1.matchId)(url, VALID_URL).toLowerCase();
        let token = await this.fetchToken(videoId);
        let data;
        try {
            data = await this.callApi(`gifs/${videoId}?views=yes`, videoId, token);
        }
        catch (err) {
            const status = err.statusCode;
            if (status !== 401)
                throw err;
            token = await this.fetchToken(videoId);
            data = await this.callApi(`gifs/${videoId}?views=yes`, videoId, token);
        }
        if (data.error)
            throw new Error(`RedGifs said: ${data.error}`);
        const gif = data.gif;
        if (!gif?.urls)
            throw new Error(`RedGifs ${videoId} missing urls`);
        const origHeight = gif.height || 0;
        const aspect = origHeight && gif.width ? gif.width / origHeight : null;
        const formats = [];
        for (const [formatId, heightHint] of Object.entries(FORMAT_HEIGHT)) {
            const videoUrl = gif.urls[formatId];
            if (!videoUrl)
                continue;
            const height = Math.min(origHeight || heightHint || 0, heightHint || origHeight || 0) || null;
            formats.push((0, helpers_1.progressiveFormat)(videoUrl, {
                format_id: formatId,
                width: aspect && height ? Math.round(height * aspect) : gif.width ?? null,
                height,
                ext: formatId === "gif" ? "gif" : "mp4",
            }));
        }
        if (!formats.length)
            throw new Error(`No playable formats for RedGifs ${videoId}`);
        return (0, helpers_1.baseInfo)(RedGifsIE.IE_NAME, url, {
            id: gif.id || videoId,
            title: (gif.tags || []).join(" ") || "RedGifs",
            uploader: gif.userName || null,
            timestamp: gif.createDate ?? null,
            duration: gif.duration ?? null,
            view_count: gif.views ?? null,
            like_count: gif.likes ?? null,
            age_limit: 18,
            tags: gif.tags,
            formats,
        });
    }
}
exports.RedGifsIE = RedGifsIE;
//# sourceMappingURL=redgifs.js.map