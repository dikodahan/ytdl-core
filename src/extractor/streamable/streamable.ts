import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import { baseInfo, matchId, progressiveFormat } from "../_shared/helpers";

const VALID_URL = /https?:\/\/streamable\.com\/(?:[es]\/)?(?<id>\w+)/i;

interface StreamableFile {
  url?: string;
  width?: number;
  height?: number;
  size?: number;
  framerate?: number;
  bitrate?: number;
}

interface StreamableVideo {
  status?: number;
  title?: string;
  reddit_title?: string;
  description?: string;
  thumbnail_url?: string;
  duration?: number;
  date_added?: number;
  plays?: number;
  files?: Record<string, StreamableFile>;
  owner?: { user_name?: string };
}

function absUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

export class StreamableIE extends InfoExtractor {
  static IE_NAME = "streamable";
  static IE_DESC = "Streamable";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — progressive mp4`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const id = matchId(url, VALID_URL);
    const video = await this.request.json<StreamableVideo>(
      `https://ajax.streamable.com/videos/${id}`,
    );

    if (video.status !== 2) {
      throw new Error(
        "This Streamable video is currently unavailable. It may still be uploading or processing.",
      );
    }

    const formats: Format[] = [];
    for (const [key, info] of Object.entries(video.files || {})) {
      const fileUrl = absUrl(info.url);
      if (!fileUrl) continue;
      formats.push(
        progressiveFormat(fileUrl, {
          format_id: key,
          width: info.width ?? null,
          height: info.height ?? null,
          filesize: info.size ?? null,
          fps: info.framerate ?? null,
          tbr: info.bitrate != null ? info.bitrate / 1000 : null,
        }),
      );
    }

    if (!formats.length) throw new Error(`No playable formats for Streamable ${id}`);

    return baseInfo(StreamableIE.IE_NAME, url, {
      id,
      title: video.reddit_title || video.title || id,
      description: video.description || null,
      thumbnail: absUrl(video.thumbnail_url),
      uploader: video.owner?.user_name || null,
      timestamp: video.date_added ?? null,
      duration: video.duration ?? null,
      view_count: video.plays ?? null,
      formats,
    });
  }
}
