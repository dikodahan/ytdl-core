"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwitchIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:(?:(?:www|go|m)\.)?twitch\.tv\/(?:[^/]+\/v(?:ideo)?|videos)\/|player\.twitch\.tv\/\?.*?\bvideo=v?)(?<id>\d+)/i;
const CLIENT_IDS = [
    "kimne78kx3ncx6brgo4mv6wki5h1ko",
    "ue6666qo983tsx6so1t0vnawi233wa",
];
class TwitchIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "twitch";
    static IE_DESC = "Twitch VODs";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — HLS via usher`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    async gql(clientId, ops) {
        return this.request.json("https://gql.twitch.tv/gql", {
            method: "POST",
            headers: {
                "Content-Type": "text/plain;charset=UTF-8",
                "Client-ID": clientId,
            },
            body: JSON.stringify(ops),
        });
    }
    async extract(url) {
        const id = (0, helpers_1.matchId)(url, VALID_URL);
        let token = null;
        let title = `Twitch VOD ${id}`;
        let uploader = null;
        let usedClient = CLIENT_IDS[0];
        const tokenQuery = {
            query: `{
        videoPlaybackAccessToken(
          id: "${id}",
          params: { platform: "web", playerBackend: "mediaplayer", playerType: "site" }
        ) { value signature }
      }`,
        };
        for (const clientId of CLIENT_IDS) {
            try {
                const res = await this.gql(clientId, tokenQuery);
                const access = res.data?.videoPlaybackAccessToken;
                if (access?.value && access.signature) {
                    token = access;
                    usedClient = clientId;
                    break;
                }
            }
            catch {
                /* try next client */
            }
        }
        if (!token)
            throw new Error(`Unable to obtain Twitch playback access token for ${id}`);
        try {
            const meta = await this.gql(usedClient, [
                {
                    operationName: "VideoMetadata",
                    variables: { channelLogin: "", videoID: id },
                    extensions: {
                        persistedQuery: {
                            version: 1,
                            sha256Hash: "300db574bd20200fc33c574b6ab48c5415e1894077692b1dba10df30a1d37324",
                        },
                    },
                },
            ]);
            const video = Array.isArray(meta) ? meta[0]?.data?.video : meta.data?.video;
            if (video?.title)
                title = video.title;
            uploader = video?.owner?.displayName || video?.owner?.login || null;
        }
        catch {
            /* metadata optional */
        }
        const usher = new URL(`https://usher.ttvnw.net/vod/${id}.m3u8`);
        usher.searchParams.set("allow_source", "true");
        usher.searchParams.set("allow_audio_only", "true");
        usher.searchParams.set("allow_spectre", "true");
        usher.searchParams.set("player", "twitchweb");
        usher.searchParams.set("playlist_include_framerate", "true");
        usher.searchParams.set("sig", token.signature);
        usher.searchParams.set("token", token.value);
        return (0, helpers_1.baseInfo)("twitch", url, {
            id: `v${id}`,
            title,
            uploader,
            formats: [(0, helpers_1.hlsFormat)(usher.toString(), "hls")],
            was_live: true,
        });
    }
}
exports.TwitchIE = TwitchIE;
//# sourceMappingURL=twitch.js.map