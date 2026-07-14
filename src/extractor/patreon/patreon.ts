import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  hlsFormat,
  matchId,
  progressiveFormat,
} from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?:www\.)?patreon\.com\/(?:creation\?hid=|(?:[^/?#]+\/)?posts\/(?:[\w-]+-)?)(?<id>\d+)/i;

interface PatreonPostFile {
  url?: string;
  name?: string;
  media_id?: number;
}

interface PatreonAttributes {
  title?: string;
  content?: string;
  content_teaser_text?: string;
  cleaned_teaser_text?: string;
  post_file?: PatreonPostFile | null;
  current_user_can_view?: boolean | null;
  image?: { large_url?: string; url?: string };
  embed?: { url?: string };
}

interface PatreonMediaAttrs {
  download_url?: string;
  mimetype?: string;
  size_bytes?: number | null;
  file_name?: string;
}

interface PatreonApiResponse {
  data?: { attributes?: PatreonAttributes };
  included?: Array<{
    type?: string;
    id?: string;
    attributes?: PatreonMediaAttrs & { full_name?: string; url?: string };
  }>;
}

function guessExt(nameOrUrl?: string): string | undefined {
  if (!nameOrUrl) return undefined;
  const m = nameOrUrl.split("?")[0]?.match(/\.([a-z0-9]{2,5})$/i);
  return m?.[1]?.toLowerCase();
}

export class PatreonIE extends InfoExtractor {
  static IE_NAME = "patreon";
  static IE_DESC = "Patreon posts";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — post_file / media download`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const id = matchId(url, VALID_URL);
    const post = await this.request.json<PatreonApiResponse>(
      `https://www.patreon.com/api/posts/${id}`,
      {
        query: {
          "fields[media]": "download_url,mimetype,size_bytes,file_name",
          "fields[post]":
            "comment_count,content,content_teaser_text,cleaned_teaser_text,embed,image,like_count,post_file,published_at,title,current_user_can_view",
          "fields[user]": "full_name,url",
          "json-api-use-default-includes": "false",
          include: "audio,user,attachments_media",
        },
        headers: {
          Referer: "https://www.patreon.com/",
        },
      },
    );

    const attributes = post.data?.attributes;
    if (!attributes) throw new Error(`Patreon post not found: ${id}`);

    const formats: Format[] = [];
    const postFile = attributes.post_file;
    if (postFile?.url) {
      const name = postFile.name || "";
      const ext = guessExt(name) || guessExt(postFile.url);
      if (name === "video" || ext === "m3u8" || /\.m3u8/i.test(postFile.url)) {
        formats.push(hlsFormat(postFile.url, "hls"));
      } else {
        formats.push(
          progressiveFormat(postFile.url, {
            format_id: "post_file",
            ext: ext || "mp4",
            has_video: !/^(mp3|m4a|aac|wav|flac)$/i.test(ext || ""),
            vcodec: /^(mp3|m4a|aac|wav|flac)$/i.test(ext || "") ? "none" : "unknown",
          }),
        );
      }
    }

    for (const include of post.included || []) {
      if (include.type !== "media") continue;
      const media = include.attributes;
      const downloadUrl = media?.download_url;
      if (!downloadUrl || media.size_bytes == null) continue;
      const ext =
        media.mimetype?.split("/")[1] ||
        guessExt(media.file_name) ||
        guessExt(downloadUrl) ||
        "mp4";
      formats.push(
        progressiveFormat(downloadUrl, {
          format_id: `media-${include.id || formats.length}`,
          ext,
          filesize: media.size_bytes,
          has_video: !/^audio\//i.test(media.mimetype || ""),
          vcodec: /^audio\//i.test(media.mimetype || "") ? "none" : "unknown",
        }),
      );
    }

    const canView = attributes.current_user_can_view;
    if (!formats.length) {
      if (canView === false) {
        throw new Error(
          `Patreon post ${id} is locked or requires a patron session cookie`,
        );
      }
      throw new Error(`No supported media found in Patreon post ${id}`);
    }

    const uploader =
      post.included?.find(i => i.type === "user")?.attributes?.full_name || null;
    const thumbnail = attributes.image?.large_url || attributes.image?.url;

    return baseInfo("patreon", url, {
      id,
      title: attributes.title?.trim() || id,
      description:
        attributes.content ||
        attributes.content_teaser_text ||
        attributes.cleaned_teaser_text ||
        null,
      uploader,
      thumbnail,
      formats,
    });
  }
}
