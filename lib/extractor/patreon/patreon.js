"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatreonIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:www\.)?patreon\.com\/(?:creation\?hid=|(?:[^/?#]+\/)?posts\/(?:[\w-]+-)?)(?<id>\d+)/i;
function guessExt(nameOrUrl) {
    if (!nameOrUrl)
        return undefined;
    const m = nameOrUrl.split("?")[0]?.match(/\.([a-z0-9]{2,5})$/i);
    return m?.[1]?.toLowerCase();
}
class PatreonIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "patreon";
    static IE_DESC = "Patreon posts";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — post_file / media download`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async extract(url) {
        const id = (0, helpers_1.matchId)(url, VALID_URL);
        const post = await this.request.json(`https://www.patreon.com/api/posts/${id}`, {
            query: {
                "fields[media]": "download_url,mimetype,size_bytes,file_name",
                "fields[post]": "comment_count,content,content_teaser_text,cleaned_teaser_text,embed,image,like_count,post_file,published_at,title,current_user_can_view",
                "fields[user]": "full_name,url",
                "json-api-use-default-includes": "false",
                include: "audio,user,attachments_media",
            },
            headers: {
                Referer: "https://www.patreon.com/",
            },
        });
        const attributes = post.data?.attributes;
        if (!attributes)
            throw new Error(`Patreon post not found: ${id}`);
        const formats = [];
        const postFile = attributes.post_file;
        if (postFile?.url) {
            const name = postFile.name || "";
            const ext = guessExt(name) || guessExt(postFile.url);
            if (name === "video" || ext === "m3u8" || /\.m3u8/i.test(postFile.url)) {
                formats.push((0, helpers_1.hlsFormat)(postFile.url, "hls"));
            }
            else {
                formats.push((0, helpers_1.progressiveFormat)(postFile.url, {
                    format_id: "post_file",
                    ext: ext || "mp4",
                    has_video: !/^(mp3|m4a|aac|wav|flac)$/i.test(ext || ""),
                    vcodec: /^(mp3|m4a|aac|wav|flac)$/i.test(ext || "") ? "none" : "unknown",
                }));
            }
        }
        for (const include of post.included || []) {
            if (include.type !== "media")
                continue;
            const media = include.attributes;
            const downloadUrl = media?.download_url;
            if (!downloadUrl || media.size_bytes == null)
                continue;
            const ext = media.mimetype?.split("/")[1] ||
                guessExt(media.file_name) ||
                guessExt(downloadUrl) ||
                "mp4";
            formats.push((0, helpers_1.progressiveFormat)(downloadUrl, {
                format_id: `media-${include.id || formats.length}`,
                ext,
                filesize: media.size_bytes,
                has_video: !/^audio\//i.test(media.mimetype || ""),
                vcodec: /^audio\//i.test(media.mimetype || "") ? "none" : "unknown",
            }));
        }
        const canView = attributes.current_user_can_view;
        if (!formats.length) {
            if (canView === false) {
                throw new Error(`Patreon post ${id} is locked or requires a patron session cookie`);
            }
            throw new Error(`No supported media found in Patreon post ${id}`);
        }
        const uploader = post.included?.find(i => i.type === "user")?.attributes?.full_name || null;
        const thumbnail = attributes.image?.large_url || attributes.image?.url;
        return (0, helpers_1.baseInfo)("patreon", url, {
            id,
            title: attributes.title?.trim() || id,
            description: attributes.content ||
                attributes.content_teaser_text ||
                attributes.cleaned_teaser_text ||
                null,
            uploader,
            thumbnail,
            formats,
        });
    }
}
exports.PatreonIE = PatreonIE;
//# sourceMappingURL=patreon.js.map