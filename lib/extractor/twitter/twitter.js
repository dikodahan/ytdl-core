"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwitterIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const VALID_URL = /^https?:\/\/(?:(?:www|m(?:obile)?)\.)?(?:twitter|x)\.com\/(?:(?:i\/web|[^/]+)\/status|statuses)\/(?<id>\d+)/i;
const BEARER = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
const GRAPHQL_ENDPOINT = "2ICDjqPd81tulZcYrtpTuQ/TweetResultByRestId";
function syndicationToken(twid) {
    // ((Number(twid) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '')
    const n = (Number(twid) / 1e15) * Math.PI;
    return n.toString(36).replace(/0+|\./g, "");
}
class TwitterIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "twitter";
    static IE_DESC = "Twitter / X";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — mp4 / HLS variants`,
            validUrl: String(this._VALID_URL),
            options: [],
        };
    }
    formatsFromVariants(variants) {
        const formats = [];
        for (const v of variants) {
            if (!v.url)
                continue;
            if (v.content_type === "application/x-mpegURL" || /\.m3u8/i.test(v.url)) {
                formats.push((0, helpers_1.hlsFormat)(v.url, "hls"));
            }
            else {
                const tbr = v.bitrate ? Math.round(v.bitrate / 1000) : null;
                const dim = v.url.match(/\/(\d+)x(\d+)\//);
                formats.push((0, helpers_1.progressiveFormat)(v.url, {
                    format_id: tbr != null ? `http-${tbr}` : "http",
                    tbr,
                    width: dim ? Number(dim[1]) : null,
                    height: dim ? Number(dim[2]) : null,
                    ext: "mp4",
                }));
            }
        }
        return formats;
    }
    async viaSyndication(twid) {
        const status = await this.request.json("https://cdn.syndication.twimg.com/tweet-result", {
            query: { id: twid, token: syndicationToken(twid) },
            headers: { "User-Agent": "Googlebot" },
        });
        const medias = status.mediaDetails || [];
        const formats = [];
        let duration = null;
        let thumbnail;
        for (const media of medias) {
            if (media.type !== "video" && media.type !== "animated_gif")
                continue;
            if (media.media_url_https)
                thumbnail = media.media_url_https;
            if (media.video_info?.duration_millis) {
                duration = media.video_info.duration_millis / 1000;
            }
            formats.push(...this.formatsFromVariants(media.video_info?.variants || []));
        }
        const uploader = status.user?.name || status.user?.screen_name || null;
        const text = (status.text || "").replace(/\n/g, " ");
        return {
            formats,
            title: uploader ? `${uploader} - ${text}` : text || twid,
            uploader,
            thumbnail,
            duration,
        };
    }
    async viaGraphql(twid) {
        const guest = await this.request.json("https://api.x.com/1.1/guest/activate.json", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${BEARER}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "",
        });
        if (!guest.guest_token)
            return null;
        const variables = JSON.stringify({
            tweetId: twid,
            withCommunity: false,
            includePromotedContent: false,
            withVoice: false,
        });
        const features = JSON.stringify({
            creator_subscriptions_tweet_preview_api_enabled: true,
            tweetypie_unmention_optimization_enabled: true,
            responsive_web_graphql_exclude_directive_enabled: true,
            verified_phone_label_enabled: false,
            responsive_web_graphql_timeline_navigation_enabled: true,
            responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
            tweet_awards_web_tipping_enabled: false,
            freedom_of_speech_not_reach_fetch_enabled: true,
            standardized_nudges_misinfo: true,
            tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
            longform_notetweets_consumption_enabled: true,
            longform_notetweets_rich_text_read_enabled: true,
            longform_notetweets_inline_media_enabled: true,
            responsive_web_enhance_cards_enabled: false,
            rweb_video_timestamps_enabled: true,
        });
        const data = await this.request.json(`https://x.com/i/api/graphql/${GRAPHQL_ENDPOINT}`, {
            query: { variables, features },
            headers: {
                Authorization: `Bearer ${BEARER}`,
                "x-guest-token": guest.guest_token,
                "x-twitter-client-language": "en",
                "x-twitter-active-user": "yes",
            },
        });
        const result = data.data?.tweetResult?.result;
        const legacy = result?.legacy;
        if (!legacy)
            return null;
        const medias = legacy.extended_entities?.media || legacy.entities?.media || [];
        const formats = [];
        let duration = null;
        let thumbnail;
        for (const media of medias) {
            if (media.type !== "video" && media.type !== "animated_gif")
                continue;
            if (media.media_url_https)
                thumbnail = media.media_url_https;
            if (media.video_info?.duration_millis) {
                duration = media.video_info.duration_millis / 1000;
            }
            formats.push(...this.formatsFromVariants(media.video_info?.variants || []));
        }
        const user = result?.core?.user_results?.result?.legacy;
        const uploader = user?.name || user?.screen_name || null;
        const text = (legacy.full_text || "").replace(/\n/g, " ");
        return {
            formats,
            title: uploader ? `${uploader} - ${text}` : text || twid,
            uploader,
            thumbnail,
            duration,
        };
    }
    async extract(url) {
        const id = (0, helpers_1.matchId)(url, VALID_URL);
        let extracted = null;
        try {
            extracted = await this.viaGraphql(id);
        }
        catch {
            extracted = null;
        }
        if (!extracted?.formats.length) {
            extracted = await this.viaSyndication(id);
        }
        if (!extracted.formats.length) {
            throw new Error(`No video variants found for tweet ${id}`);
        }
        return (0, helpers_1.baseInfo)("twitter", url, {
            id,
            title: extracted.title,
            uploader: extracted.uploader,
            thumbnail: extracted.thumbnail,
            duration: extracted.duration,
            formats: extracted.formats,
        });
    }
}
exports.TwitterIE = TwitterIE;
//# sourceMappingURL=twitter.js.map