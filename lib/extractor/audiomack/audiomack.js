"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudiomackIE = void 0;
const crypto = __importStar(require("crypto"));
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
/** Legacy `/song/user/slug` and current `/user/song/slug` share paths. */
const VALID_URL = /^https?:\/\/(?:www\.)?audiomack\.com\/(?:song\/(?<uploader>[\w-]+)\/(?<slug>[\w-]+)|(?<uploader2>[\w-]+)\/song\/(?<slug2>[\w-]+))/i;
const API_BASE = "https://api.audiomack.com/v1";
const CONSUMER_KEY = "audiomack-web";
const CONSUMER_SECRET = "bd8a07e9f23fbe9d808646b730f89b8e";
function oauthParams(method, url, extra = {}) {
    const oauth = {
        oauth_consumer_key: CONSUMER_KEY,
        oauth_nonce: crypto.randomBytes(16).toString("hex"),
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: String(Math.floor(Date.now() / 1000)),
        oauth_version: "1.0",
        ...extra,
    };
    const base = Object.keys(oauth)
        .sort()
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauth[k])}`)
        .join("&");
    const baseString = [method.toUpperCase(), encodeURIComponent(url), encodeURIComponent(base)].join("&");
    const key = `${encodeURIComponent(CONSUMER_SECRET)}&`;
    oauth.oauth_signature = crypto.createHmac("sha1", key).update(baseString).digest("base64");
    return oauth;
}
class AudiomackIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "audiomack";
    static IE_DESC = "Audiomack songs";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — progressive audio (OAuth API)`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async apiGet(path, extraQuery = {}) {
        const url = `${API_BASE}${path}`;
        const oauth = oauthParams("GET", url, extraQuery);
        return this.request.json(url, { query: oauth });
    }
    async extract(url) {
        const m = url.match(VALID_URL);
        const uploader = m?.groups?.uploader || m?.groups?.uploader2;
        const slug = m?.groups?.slug || m?.groups?.slug2;
        if (!uploader || !slug)
            throw new Error(`Could not parse Audiomack URL: ${url}`);
        const meta = await this.apiGet(`/music/song/${uploader}/${slug}`);
        const song = meta.results;
        if (!song?.id)
            throw new Error(`Invalid Audiomack song ${uploader}/${slug}`);
        const play = await this.apiGet(`/music/play/${song.id}`);
        const streamUrl = play.signedUrl || play.url || song.url;
        if (!streamUrl)
            throw new Error(`No stream URL for Audiomack song ${song.id}`);
        // SoundCloud-wrapped tracks: return SC URL for the soundcloud extractor via error note.
        if (/soundcloud\.com/i.test(streamUrl)) {
            throw new Error(`Audiomack wraps a SoundCloud track — extract with service=soundcloud: ${streamUrl}`);
        }
        const formats = [
            (0, helpers_1.progressiveFormat)(streamUrl, {
                format_id: "http",
                ext: "mp3",
                has_video: false,
                vcodec: "none",
                acodec: "mp3",
            }),
        ];
        const duration = typeof song.duration === "string" ? Number(song.duration) : song.duration;
        return (0, helpers_1.baseInfo)("audiomack", url, {
            id: String(song.id),
            title: song.title || slug,
            description: song.description || null,
            uploader: song.artist || song.uploader?.name || uploader,
            thumbnail: song.image,
            duration: Number.isFinite(duration) ? duration : null,
            formats,
        });
    }
}
exports.AudiomackIE = AudiomackIE;
//# sourceMappingURL=audiomack.js.map