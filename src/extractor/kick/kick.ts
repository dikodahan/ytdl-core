import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  hlsFormat,
  progressiveFormat,
} from "../_shared/helpers";

const VOD_URL =
  /^https?:\/\/(?:www\.)?kick\.com\/(?<channel>[^/]+)\/videos\/(?<id>[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})/i;
const CLIP_URL =
  /^https?:\/\/(?:www\.)?kick\.com\/[\w-]+(?:\/clips\/|\/?\?(?:[^#]+&)?clip=)(?<id>clip_[\w-]+)/i;
const VALID_URL =
  /^https?:\/\/(?:www\.)?kick\.com\/(?:[\w-]+\/videos\/(?<vod_id>[0-9a-f-]{36})|[\w-]+(?:\/clips\/|\/?\?(?:[^#]+&)?clip=)(?<clip_id>clip_[\w-]+))/i;

interface KickVodResponse {
  source?: string;
  views?: number;
  livestream?: {
    session_title?: string;
    slug?: string;
    duration?: number;
    thumbnail?: string;
    is_live?: boolean;
    is_mature?: boolean;
    channel?: {
      slug?: string;
      id?: number;
      user?: { username?: string; bio?: string };
      user_id?: number;
    };
    categories?: Array<{ name?: string }>;
  };
}

interface KickClipResponse {
  clip?: {
    title?: string;
    clip_url?: string;
    thumbnail_url?: string;
    duration?: number;
    channel?: { slug?: string; id?: number };
    creator?: { username?: string; id?: number };
  };
}

export class KickIE extends InfoExtractor {
  static IE_NAME = "kick";
  static IE_DESC = "Kick VOD / clips";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — HLS`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const clipMatch = url.match(CLIP_URL);
    if (clipMatch?.groups?.id) {
      return this.extractClip(url, clipMatch.groups.id);
    }

    const vodMatch = url.match(VOD_URL);
    if (!vodMatch?.groups?.id) throw new Error(`Could not extract id from URL: ${url}`);
    return this.extractVod(url, vodMatch.groups.id);
  }

  private async extractVod(url: string, videoId: string): Promise<InfoDict> {
    const response = await this.request.json<KickVodResponse>(
      `https://kick.com/api/v1/video/${videoId}`,
    );
    if (!response.source) throw new Error(`No Kick VOD source for ${videoId}`);

    const formats: Format[] = [hlsFormat(response.source, "hls")];
    const live = response.livestream;

    return baseInfo("kick", url, {
      id: videoId,
      title: live?.session_title || live?.slug || videoId,
      description: live?.channel?.user?.bio || null,
      uploader: live?.channel?.user?.username || null,
      uploader_id: live?.channel?.user_id != null ? String(live.channel.user_id) : null,
      duration: live?.duration != null ? live.duration / 1000 : null,
      thumbnail: live?.thumbnail,
      formats,
    });
  }

  private async extractClip(url: string, clipId: string): Promise<InfoDict> {
    const response = await this.request.json<KickClipResponse>(
      `https://kick.com/api/v2/clips/${clipId}/play`,
    );
    const clip = response.clip;
    if (!clip?.clip_url) throw new Error(`No Kick clip url for ${clipId}`);

    const formats: Format[] = /\.m3u8/i.test(clip.clip_url)
      ? [hlsFormat(clip.clip_url, "hls")]
      : [progressiveFormat(clip.clip_url, { format_id: "http" })];

    return baseInfo("kick", url, {
      id: clipId,
      title: clip.title || clipId,
      uploader: clip.creator?.username || null,
      uploader_id: clip.creator?.id != null ? String(clip.creator.id) : null,
      duration: clip.duration ?? null,
      thumbnail: clip.thumbnail_url,
      formats,
    });
  }
}
