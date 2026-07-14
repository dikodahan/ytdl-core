import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  matchId,
  progressiveFormat,
} from "../_shared/helpers";

const VALID_URL = /^https?:\/\/(?:www\.)?9gag\.com\/gag\/(?<id>[^/?&#]+)/i;

interface NineGagImage {
  url?: string;
  width?: number;
  height?: number;
  duration?: number;
  hasAudio?: number;
  vp8Url?: string;
  vp9Url?: string;
  h265Url?: string;
  webpUrl?: string;
}

interface NineGagPost {
  type?: string;
  title?: string;
  creationTs?: number;
  images?: Record<string, NineGagImage>;
  creator?: { fullName?: string; username?: string; profileUrl?: string };
  nsfw?: number;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function guessExt(url: string): string | undefined {
  return url.split("?")[0]?.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
}

export class NinegagIE extends InfoExtractor {
  static IE_NAME = "ninegag";
  static IE_DESC = "9GAG";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — Animated progressive`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const id = matchId(url, VALID_URL);
    const payload = await this.request.json<{ data?: { post?: NineGagPost } }>(
      "https://9gag.com/v1/post",
      { query: { id } },
    );
    const post = payload.data?.post;
    if (!post) throw new Error(`9GAG post not found: ${id}`);
    if (post.type !== "Animated") {
      throw new Error(`9GAG post ${id} is not Animated (no video)`);
    }

    const formats: Format[] = [];
    let duration: number | null = null;
    let thumbnail: string | undefined;

    for (const [key, image] of Object.entries(post.images || {})) {
      const imageUrl = image.url;
      if (!imageUrl) continue;
      const ext = guessExt(imageUrl);
      const imageId = key.replace(/^image/, "") || key;

      if (ext === "jpg" || ext === "png") {
        if (!thumbnail) thumbnail = image.webpUrl || imageUrl;
        continue;
      }

      if (ext !== "webm" && ext !== "mp4") continue;
      if (duration == null && image.duration != null) duration = image.duration;

      const common = {
        width: image.width ?? null,
        height: image.height ?? null,
        has_audio: image.hasAudio !== 0,
        acodec: image.hasAudio === 0 ? "none" : "unknown",
      } as const;

      for (const [vcodec, vUrl] of [
        ["vp8", image.vp8Url],
        ["vp9", image.vp9Url],
        ["h265", image.h265Url],
      ] as const) {
        if (!vUrl) continue;
        formats.push(
          progressiveFormat(vUrl, {
            format_id: `${imageId}-${vcodec}`,
            vcodec,
            ...common,
          }),
        );
      }

      formats.push(
        progressiveFormat(imageUrl, {
          format_id: imageId,
          ext,
          ...common,
        }),
      );
    }

    if (!formats.length) throw new Error(`No playable formats for 9GAG post ${id}`);

    return baseInfo("ninegag", url, {
      id,
      title: post.title ? decodeHtml(post.title) : id,
      uploader: post.creator?.fullName || post.creator?.username || null,
      uploader_id: post.creator?.username || null,
      duration,
      thumbnail,
      formats,
    });
  }
}
