"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DropboxIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /https?:\/\/(?:www\.)?dropbox\.com\/(?:(?:e\/)?scl\/f[io]|sh?)\/(?<id>\w+)/i;
function decodePrefetchParts(webpage) {
    const parts = [];
    for (const m of webpage.matchAll(/registerStreamedPrefetch\s*\(\s*"[\w/+=]+"\s*,\s*"([\w/+=]+)"/g)) {
        try {
            parts.push(Buffer.from(m[1], "base64").toString("utf8"));
        }
        catch {
            /* ignore */
        }
    }
    return parts.reverse();
}
function urlBasename(url) {
    try {
        const path = new URL(url).pathname;
        const seg = path.split("/").filter(Boolean).pop() || "";
        return decodeURIComponent(seg);
    }
    catch {
        return "";
    }
}
class DropboxIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "dropbox";
    static IE_DESC = "Dropbox";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — original + HLS preview`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const id = (0, helpers_1.matchId)(url, VALID_URL);
        let webpage = await this.request.text(url);
        const parts = decodePrefetchParts(webpage);
        let contentId;
        for (const part of parts) {
            if (part.includes("/sm/password")) {
                contentId = part.match(/content_id=([\w.+=/-]+)/)?.[1];
                break;
            }
        }
        if (contentId) {
            const password = this.params.extractorArgs?.videopassword;
            if (typeof password !== "string" || !password) {
                throw new Error("Password protected Dropbox video — pass extractorArgs.videopassword");
            }
            const cookieT = this.request.agent.jar
                .getCookiesSync("https://www.dropbox.com")
                .find(c => c.key === "t")?.value;
            const authBody = new URLSearchParams({
                is_xhr: "true",
                t: cookieT || "",
                content_id: contentId,
                password,
                url: url.replace(/^https?:\/\/(?:www\.)?dropbox\.com/i, ""),
            });
            const auth = await this.request.json("https://www.dropbox.com/sm/auth", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: authBody.toString(),
            });
            if (auth.status !== "authed")
                throw new Error("Invalid Dropbox password");
            webpage = await this.request.text(url);
        }
        const formats = [];
        let thumbnail;
        let hasAnonymousDownload = false;
        for (const part of decodePrefetchParts(webpage)) {
            if (!hasAnonymousDownload && part.includes("anonymous:\tanonymous")) {
                hasAnonymousDownload = true;
            }
            const m3u8 = part.match(/\n.?(https:\/\/[^\x03\x08\x12\n]+\.m3u8)/)?.[1];
            if (m3u8) {
                formats.push((0, helpers_1.hlsFormat)(m3u8));
                thumbnail =
                    part.match(/(https:\/\/www\.dropbox\.com\/temp_thumb_from_token\/[\w/?&=]+)/)?.[1] ||
                        thumbnail;
                break;
            }
        }
        const dlUrl = new URL(url);
        dlUrl.searchParams.set("dl", "1");
        if (hasAnonymousDownload || !formats.length) {
            formats.push((0, helpers_1.progressiveFormat)(dlUrl.toString(), {
                format_id: "original",
                format_note: "Original",
                quality: 1,
            }));
        }
        if (!formats.length)
            throw new Error(`No playable formats for Dropbox ${id}`);
        const fn = urlBasename(url);
        const title = fn.replace(/\.[^.]+$/, "") || id;
        return (0, helpers_1.baseInfo)(DropboxIE.IE_NAME, url, {
            id,
            title,
            thumbnail,
            formats,
        });
    }
}
exports.DropboxIE = DropboxIE;
//# sourceMappingURL=dropbox.js.map