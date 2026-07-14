import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import { baseInfo, matchId, progressiveFormat } from "../_shared/helpers";

const VALID_URL =
  /https?:\/\/(?:i\.)?imgur\.com\/(?!(?:a|gallery|t|topic|r)\/)(?:[^/?#]+-)?(?<id>[a-zA-Z0-9]+)/i;

const CLIENT_ID = "546c25a59c58ad7";

interface ImgurMedia {
  url?: string;
  ext?: string;
  width?: number;
  height?: number;
  size?: number;
  type?: string;
  mime_type?: string;
  metadata?: {
    is_animated?: boolean;
    has_sound?: boolean;
    title?: string;
    description?: string;
    duration?: number;
  };
}

interface ImgurPost {
  media?: ImgurMedia[];
  title?: string;
  account?: { username?: string };
  account_id?: number | string;
  upvote_count?: number;
  downvote_count?: number;
  comment_count?: number;
  is_mature?: boolean;
}

function mimeExt(mime?: string): string | undefined {
  if (!mime) return undefined;
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("gif")) return "gif";
  return mime.split("/")[1]?.split(";")[0];
}

export class ImgurIE extends InfoExtractor {
  static IE_NAME = "imgur";
  static IE_DESC = "Imgur";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — gifv / video progressive`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const id = matchId(url, VALID_URL);
    const data = await this.request.json<ImgurPost>(
      `https://api.imgur.com/post/v1/media/${id}`,
      { query: { client_id: CLIENT_ID, include: "media,account" } },
    );

    const media = data.media?.[0];
    const isVideo =
      media?.type === "video" || media?.metadata?.is_animated;
    if (!isVideo) {
      throw new Error(`${id} is not a video or animated image`);
    }

    let webpage = "";
    try {
      webpage = await this.request.text(`https://i.imgur.com/${id}.gifv`, {
        headers: { Accept: "*/*" },
      });
    } catch {
      /* optional */
    }

    const formats: Format[] = [];
    const headers = { Accept: "*/*" };

    if (media?.url) {
      const ext =
        media.ext || mimeExt(media.mime_type) || "mp4";
      formats.push(
        progressiveFormat(media.url, {
          format_id: ext,
          ext,
          width: media.width ?? null,
          height: media.height ?? null,
          filesize: media.size ?? null,
          acodec: media.metadata?.has_sound ? "unknown" : "none",
          has_audio: !!media.metadata?.has_sound,
          http_headers: headers,
        }),
      );
    }

    const videoElements = webpage.match(
      /<div class="video-elements">([\s\S]*?)<\/div>/i,
    )?.[1];
    if (videoElements) {
      for (const sm of videoElements.matchAll(
        /<source\s+src="(?<src>[^"]+)"\s+type="(?<type>[^"]+)"/gi,
      )) {
        const src = sm.groups?.src;
        const type = sm.groups?.type || "";
        if (!src) continue;
        const abs = src.startsWith("//") ? `https:${src}` : src;
        formats.push(
          progressiveFormat(abs, {
            format_id: type.split("/")[1] || "http",
            ext: mimeExt(type) || "mp4",
            http_headers: headers,
          }),
        );
      }
    }

    const twitterStream = webpage.match(
      /<meta[^>]+name=["']twitter:player:stream["'][^>]+content=["']([^"']+)["']/i,
    )?.[1];
    if (twitterStream) {
      formats.push(
        progressiveFormat(twitterStream, {
          format_id: "twitter",
          http_headers: headers,
        }),
      );
    }

    if (!formats.length) {
      throw new Error(`No sources found for Imgur video ${id}`);
    }

    const ogTitle = webpage.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    )?.[1];
    const title =
      media?.metadata?.title || data.title || ogTitle || id;
    const thumb =
      webpage.match(
        /<meta[^>]+(?:name|property)=["'](?:thumbnailUrl|twitter:image|og:image)["'][^>]+content=["']([^"']+)["']/i,
      )?.[1] || `https://i.imgur.com/${id}h.jpg`;

    return baseInfo(ImgurIE.IE_NAME, url, {
      id,
      title,
      description: media?.metadata?.description || null,
      uploader: data.account?.username || null,
      uploader_id: data.account_id != null ? String(data.account_id) : null,
      duration: media?.metadata?.duration ?? null,
      thumbnail: thumb,
      age_limit: data.is_mature ? 18 : undefined,
      formats,
    });
  }
}
