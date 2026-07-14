"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MixcloudIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:(?:www|beta|m)\.)?mixcloud\.com\/(?<user>[^/]+)\/(?!stream|uploads|favorites|listens|playlists)(?<slug>[^/?#]+)/i;
const DECRYPTION_KEY = "IFYOUWANTTHEARTISTSTOGETPAIDDONOTDOWNLOADFROMMIXCLOUD";
function decryptXorCipher(key, ciphertext) {
    const out = [];
    for (let i = 0; i < ciphertext.length; i++) {
        out.push(ciphertext[i] ^ key.charCodeAt(i % key.length));
    }
    return Buffer.from(out).toString("utf8");
}
class MixcloudIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "mixcloud";
    static IE_DESC = "Mixcloud cloudcasts";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — progressive + HLS`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const m = url.match(VALID_URL);
        if (!m?.groups?.user || !m.groups.slug) {
            throw new Error(`Could not extract id from URL: ${url}`);
        }
        const username = decodeURIComponent(m.groups.user);
        const slug = decodeURIComponent(m.groups.slug);
        const trackId = `${username}_${slug}`;
        const query = `{
  cloudcastLookup(lookup: {username: "${username}", slug: "${slug}"}) {
    audioLength
    description
    isExclusive
    name
    owner { displayName url username }
    picture(width: 1024, height: 1024) { url }
    restrictedReason
    streamInfo { dashUrl hlsUrl url }
    id
  }
}`;
        const resp = await this.request.json("https://app.mixcloud.com/graphql", { query: { query } });
        const cloudcast = resp.data?.cloudcastLookup;
        if (!cloudcast)
            throw new Error(`Mixcloud track not found: ${trackId}`);
        const reason = cloudcast.restrictedReason;
        if (reason === "tracklist") {
            throw new Error("Track unavailable in your country due to licensing restrictions");
        }
        if (reason === "repeat_play") {
            throw new Error("You have reached your play limit for this track");
        }
        if (reason)
            throw new Error("Track is restricted");
        const streamInfo = cloudcast.streamInfo || {};
        const formats = [];
        for (const urlKey of ["url", "hlsUrl", "dashUrl"]) {
            const encrypted = streamInfo[urlKey];
            if (!encrypted)
                continue;
            let decrypted;
            try {
                decrypted = decryptXorCipher(DECRYPTION_KEY, Buffer.from(encrypted, "base64"));
            }
            catch {
                continue;
            }
            if (!/^https?:/i.test(decrypted))
                continue;
            if (urlKey === "hlsUrl") {
                formats.push({
                    ...(0, helpers_1.hlsFormat)(decrypted, "hls"),
                    has_video: false,
                    vcodec: "none",
                });
            }
            else if (urlKey === "dashUrl") {
                formats.push({
                    ...(0, helpers_1.dashFormat)(decrypted, "dash"),
                    has_video: false,
                    vcodec: "none",
                });
            }
            else {
                formats.push((0, helpers_1.progressiveFormat)(decrypted, {
                    format_id: "http",
                    has_video: false,
                    vcodec: "none",
                }));
            }
        }
        if (!formats.length) {
            if (cloudcast.isExclusive) {
                throw new Error("Exclusive Mixcloud track requires login");
            }
            throw new Error(`No playable formats for Mixcloud ${trackId}`);
        }
        return (0, helpers_1.baseInfo)("mixcloud", url, {
            id: trackId,
            title: cloudcast.name || trackId,
            description: cloudcast.description || null,
            uploader: cloudcast.owner?.displayName || null,
            uploader_id: cloudcast.owner?.username || null,
            duration: cloudcast.audioLength ?? null,
            thumbnail: cloudcast.picture?.url,
            formats,
        });
    }
}
exports.MixcloudIE = MixcloudIE;
//# sourceMappingURL=mixcloud.js.map