"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudflareStreamIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const SUBDOMAIN = "(?:(?:watch|iframe|customer-\\w+)\\.)?";
const DOMAIN = "(?:cloudflarestream\\.com|(?:videodelivery|bytehighway)\\.net)";
const EMBED = `(?:embed\\.|${SUBDOMAIN})${DOMAIN}/embed/[^/?#]+\\.js\\?(?:[^#]+&)?video=`;
const ID = "[\\da-f]{32}|eyJ[\\w-]+\\.[\\w-]+\\.[\\w-]+";
class CloudflareStreamIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "cloudflarestream";
    static IE_DESC = "Cloudflare Stream / video delivery embeds";
    static _VALID_URL = new RegExp(`https?://(?:${SUBDOMAIN}(?<domain>${DOMAIN})/|${EMBED})(?<id>${ID})`, "i");
    async extract(url) {
        const m = url.match(CloudflareStreamIE._VALID_URL);
        if (!m?.groups?.id)
            throw new Error(`Could not extract id from URL: ${url}`);
        let videoId = m.groups.id;
        let domain = m.groups.domain || "cloudflarestream.com";
        if (domain !== "bytehighway.net")
            domain = "cloudflarestream.com";
        // JWT signed playback tokens encode the media id in `sub`
        if (videoId.includes(".")) {
            const payload = videoId.split(".")[1] || "";
            const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
            const json = JSON.parse(Buffer.from(padded, "base64url").toString("utf8"));
            if (!json.sub)
                throw new Error("Cloudflare Stream JWT missing sub claim");
            videoId = json.sub;
        }
        const base = `https://${domain}/${m.groups.id}/`;
        const manifestBase = `${base}manifest/video.`;
        return (0, helpers_1.baseInfo)(CloudflareStreamIE.IE_NAME, url, {
            id: videoId,
            title: videoId,
            thumbnail: `${base}thumbnails/thumbnail.jpg`,
            formats: [(0, helpers_1.hlsFormat)(`${manifestBase}m3u8`), (0, helpers_1.dashFormat)(`${manifestBase}mpd`)],
        });
    }
}
exports.CloudflareStreamIE = CloudflareStreamIE;
//# sourceMappingURL=cloudflarestream.js.map