"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaFireIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /https?:\/\/(?:www\.)?mediafire\.com\/(?:download|file|file_premium|view)\/(?<id>[0-9a-zA-Z]+)(?:\/(?<title>[^/?#]+))?/i;
class MediaFireIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "mediafire";
    static IE_DESC = "MediaFire";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — direct download`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const m = url.match(VALID_URL);
        if (!m?.groups?.id)
            throw new Error(`Could not extract id from URL: ${url}`);
        const id = m.groups.id;
        const webpage = await this.request.text(url, {
            headers: { Referer: "https://www.mediafire.com/" },
        });
        const downloadUrl = webpage.match(/\bkNO\s*=\s*["'](https?:\/\/[^"']+)["']/)?.[1] ||
            webpage.match(/aria-label=["']Download file["'][^>]*href=["'](https?:\/\/[^"']+)["']/i)?.[1] ||
            webpage.match(/href=["'](https?:\/\/download\d*\.mediafire\.com\/[^"']+)["']/i)?.[1] ||
            webpage.match(/["'](https?:\/\/download\d*\.mediafire\.com\/[^"']+)["']/)?.[1];
        if (!downloadUrl) {
            if (/password/i.test(webpage) && /Enter Password/i.test(webpage)) {
                throw new Error("Password protected MediaFire file");
            }
            throw new Error(`Could not find MediaFire download URL for ${id}`);
        }
        const ogTitle = webpage.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
        const pageTitle = webpage.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
        const titleFromUrl = m.groups.title ? decodeURIComponent(m.groups.title) : undefined;
        const title = titleFromUrl ||
            ogTitle ||
            pageTitle?.replace(/\s*-\s*MediaFire\s*$/i, "").trim() ||
            id;
        const formats = [
            (0, helpers_1.progressiveFormat)(downloadUrl, {
                format_id: "http",
                http_headers: { Referer: "https://www.mediafire.com/" },
            }),
        ];
        return (0, helpers_1.baseInfo)(MediaFireIE.IE_NAME, url, {
            id,
            title,
            formats,
        });
    }
}
exports.MediaFireIE = MediaFireIE;
//# sourceMappingURL=mediafire.js.map