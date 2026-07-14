"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlueskyIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:www\.)?(?:bsky\.app|main\.bsky\.dev)\/profile\/(?<handle>[\w.:%-]+)\/post\/(?<id>\w+)/i;
function findPlaylist(embed) {
    if (!embed)
        return {};
    if (embed.playlist) {
        return { playlist: embed.playlist, thumbnail: embed.thumbnail, alt: embed.alt };
    }
    if (embed.media?.playlist) {
        return {
            playlist: embed.media.playlist,
            thumbnail: embed.media.thumbnail,
            alt: embed.media.alt,
        };
    }
    return {};
}
class BlueskyIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "bluesky";
    static IE_DESC = "Bluesky posts";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — HLS playlist embed`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async resolveDid(handle) {
        if (handle.startsWith("did:"))
            return handle;
        const res = await this.request.json("https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle", { query: { handle } });
        if (!res.did)
            throw new Error(`Could not resolve Bluesky handle: ${handle}`);
        return res.did;
    }
    async extract(url) {
        const m = url.match(VALID_URL);
        if (!m?.groups?.handle || !m.groups.id) {
            throw new Error(`Could not extract id from URL: ${url}`);
        }
        const handle = decodeURIComponent(m.groups.handle);
        const rkey = m.groups.id;
        const did = await this.resolveDid(handle);
        const data = await this.request.json("https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread", {
            query: {
                uri: `at://${did}/app.bsky.feed.post/${rkey}`,
                depth: 0,
                parentHeight: 0,
            },
        });
        const post = data.thread?.post;
        if (!post)
            throw new Error(`Bluesky post not found: ${rkey}`);
        let found = findPlaylist(post.embed);
        if (!found.playlist)
            found = findPlaylist(post.embed?.media);
        if (!found.playlist) {
            const nested = post.embed?.record?.record;
            found = findPlaylist(nested?.embed);
            if (!found.playlist)
                found = findPlaylist(nested?.embed?.media);
            if (!found.playlist) {
                const embeds = post.embed?.record?.embeds;
                if (embeds?.[0])
                    found = findPlaylist(embeds[0]);
            }
        }
        if (!found.playlist) {
            throw new Error(`No video could be found in Bluesky post ${rkey}`);
        }
        const formats = [(0, helpers_1.hlsFormat)(found.playlist, "hls")];
        const text = post.record?.text?.trim();
        const title = text
            ? text.length > 80
                ? `${text.slice(0, 77)}...`
                : text
            : `Bluesky video #${rkey}`;
        return (0, helpers_1.baseInfo)("bluesky", url, {
            id: rkey,
            title,
            description: text || null,
            uploader: post.author?.displayName || post.author?.handle || null,
            uploader_id: post.author?.handle || null,
            thumbnail: found.thumbnail,
            formats,
        });
    }
}
exports.BlueskyIE = BlueskyIE;
//# sourceMappingURL=bluesky.js.map