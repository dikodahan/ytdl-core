import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  dashFormat,
  hlsFormat,
  matchId,
  progressiveFormat,
} from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?:\w+\.)?reddit(?:media)?\.com\/(?:(?:r|user)\/[^/]+\/)?comments\/(?<id>[^/?#&]+)/i;

interface RedditVideo {
  hls_url?: string;
  dash_url?: string;
  fallback_url?: string;
  height?: number;
  width?: number;
  bitrate_kbps?: number;
  duration?: number;
}

interface RedditPostData {
  id?: string;
  title?: string;
  author?: string;
  thumbnail?: string;
  url?: string;
  secure_media?: { reddit_video?: RedditVideo };
  media?: { reddit_video?: RedditVideo };
  crosspost_parent_list?: Array<{
    secure_media?: { reddit_video?: RedditVideo };
    media?: { reddit_video?: RedditVideo };
  }>;
}

export class RedditIE extends InfoExtractor {
  static IE_NAME = "reddit";
  static IE_DESC = "Reddit videos";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — HLS / progressive fallback`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const id = matchId(url, VALID_URL);
    const clean = url.split("#")[0]!.replace(/\?.*$/, "");
    const jsonUrl = clean.replace(/\/?$/, "/") + ".json";

    const payload = await this.request.json<
      Array<{ data?: { children?: Array<{ data?: RedditPostData }> } }>
    >(jsonUrl, {
      headers: { Accept: "application/json" },
    });

    const post = payload?.[0]?.data?.children?.[0]?.data;
    if (!post) throw new Error(`Reddit post not found: ${id}`);

    const candidates: Array<RedditVideo | undefined> = [
      post.secure_media?.reddit_video,
      post.media?.reddit_video,
      ...(post.crosspost_parent_list || []).flatMap(p => [
        p.secure_media?.reddit_video,
        p.media?.reddit_video,
      ]),
    ];
    const redditVideo = candidates.find(v => v && (v.hls_url || v.fallback_url));
    if (!redditVideo) {
      throw new Error(`No reddit_video media on post ${id}`);
    }

    const formats: Format[] = [];
    if (redditVideo.hls_url) {
      formats.push(hlsFormat(unescape(redditVideo.hls_url), "hls"));
    }
    if (redditVideo.dash_url) {
      formats.push(dashFormat(unescape(redditVideo.dash_url), "dash"));
    }
    if (redditVideo.fallback_url) {
      formats.push(
        progressiveFormat(unescape(redditVideo.fallback_url), {
          format_id: "fallback",
          width: redditVideo.width ?? null,
          height: redditVideo.height ?? null,
          tbr: redditVideo.bitrate_kbps ?? null,
        }),
      );
    }

    if (!formats.length) throw new Error(`No playable formats for Reddit post ${id}`);

    const mediaId =
      redditVideo.fallback_url?.match(/v\.redd\.it\/([^/?#&]+)/)?.[1] || id;

    return baseInfo("reddit", url, {
      id: mediaId,
      display_id: id,
      title: post.title || id,
      uploader: post.author || null,
      thumbnail: post.thumbnail && post.thumbnail.startsWith("http") ? post.thumbnail : undefined,
      duration: redditVideo.duration ?? null,
      formats,
    });
  }
}

function unescape(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}
