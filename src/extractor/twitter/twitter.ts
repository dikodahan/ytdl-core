import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  hlsFormat,
  matchId,
  progressiveFormat,
} from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?:(?:www|m(?:obile)?)\.)?(?:twitter|x)\.com\/(?:(?:i\/web|[^/]+)\/status|statuses)\/(?<id>\d+)/i;

const BEARER =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

const GRAPHQL_ENDPOINT = "2ICDjqPd81tulZcYrtpTuQ/TweetResultByRestId";

interface Variant {
  url?: string;
  content_type?: string;
  bitrate?: number;
}

interface MediaEntity {
  type?: string;
  media_url_https?: string;
  video_info?: { variants?: Variant[]; duration_millis?: number };
}

function syndicationToken(twid: string): string {
  // ((Number(twid) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '')
  const n = (Number(twid) / 1e15) * Math.PI;
  return n.toString(36).replace(/0+|\./g, "");
}

export class TwitterIE extends InfoExtractor {
  static IE_NAME = "twitter";
  static IE_DESC = "Twitter / X";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — mp4 / HLS variants`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  private formatsFromVariants(variants: Variant[]): Format[] {
    const formats: Format[] = [];
    for (const v of variants) {
      if (!v.url) continue;
      if (v.content_type === "application/x-mpegURL" || /\.m3u8/i.test(v.url)) {
        formats.push(hlsFormat(v.url, "hls"));
      } else {
        const tbr = v.bitrate ? Math.round(v.bitrate / 1000) : null;
        const dim = v.url.match(/\/(\d+)x(\d+)\//);
        formats.push(
          progressiveFormat(v.url, {
            format_id: tbr != null ? `http-${tbr}` : "http",
            tbr,
            width: dim ? Number(dim[1]) : null,
            height: dim ? Number(dim[2]) : null,
            ext: "mp4",
          }),
        );
      }
    }
    return formats;
  }

  private async viaSyndication(twid: string): Promise<{
    formats: Format[];
    title: string;
    uploader: string | null;
    thumbnail?: string;
    duration: number | null;
  }> {
    const status = await this.request.json<{
      text?: string;
      user?: { name?: string; screen_name?: string };
      mediaDetails?: MediaEntity[];
    }>("https://cdn.syndication.twimg.com/tweet-result", {
      query: { id: twid, token: syndicationToken(twid) },
      headers: { "User-Agent": "Googlebot" },
    });

    const medias = status.mediaDetails || [];
    const formats: Format[] = [];
    let duration: number | null = null;
    let thumbnail: string | undefined;
    for (const media of medias) {
      if (media.type !== "video" && media.type !== "animated_gif") continue;
      if (media.media_url_https) thumbnail = media.media_url_https;
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

  private async viaGraphql(twid: string): Promise<{
    formats: Format[];
    title: string;
    uploader: string | null;
    thumbnail?: string;
    duration: number | null;
  } | null> {
    const guest = await this.request.json<{ guest_token?: string }>(
      "https://api.x.com/1.1/guest/activate.json",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${BEARER}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "",
      },
    );
    if (!guest.guest_token) return null;

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

    const data = await this.request.json<{
      data?: {
        tweetResult?: {
          result?: {
            legacy?: {
              full_text?: string;
              extended_entities?: { media?: MediaEntity[] };
              entities?: { media?: MediaEntity[] };
            };
            core?: {
              user_results?: {
                result?: { legacy?: { name?: string; screen_name?: string } };
              };
            };
          };
        };
      };
    }>(`https://x.com/i/api/graphql/${GRAPHQL_ENDPOINT}`, {
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
    if (!legacy) return null;

    const medias =
      legacy.extended_entities?.media || legacy.entities?.media || [];
    const formats: Format[] = [];
    let duration: number | null = null;
    let thumbnail: string | undefined;
    for (const media of medias) {
      if (media.type !== "video" && media.type !== "animated_gif") continue;
      if (media.media_url_https) thumbnail = media.media_url_https;
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

  async extract(url: string): Promise<InfoDict> {
    const id = matchId(url, VALID_URL);

    let extracted: {
      formats: Format[];
      title: string;
      uploader: string | null;
      thumbnail?: string;
      duration: number | null;
    } | null = null;

    try {
      extracted = await this.viaGraphql(id);
    } catch {
      extracted = null;
    }

    if (!extracted?.formats.length) {
      extracted = await this.viaSyndication(id);
    }

    if (!extracted.formats.length) {
      throw new Error(`No video variants found for tweet ${id}`);
    }

    return baseInfo("twitter", url, {
      id,
      title: extracted.title,
      uploader: extracted.uploader,
      thumbnail: extracted.thumbnail,
      duration: extracted.duration,
      formats: extracted.formats,
    });
  }
}
