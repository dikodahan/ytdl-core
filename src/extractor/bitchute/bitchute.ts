import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  hlsFormat,
  matchId,
  progressiveFormat,
} from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?:(?:www|old)\.)?bitchute\.com\/(?:video|embed|torrent\/[^/?#]+)\/(?<id>[^/?#&]+)/i;

interface BitChuteMediaResponse {
  media_url?: string;
}

interface BitChuteVideoResponse {
  video_name?: string;
  description?: string;
  thumbnail_url?: string;
  duration?: number | string;
  channel?: { channel_name?: string; channel_id?: string };
  profile?: { profile_name?: string; profile_id?: string };
}

export class BitchuteIE extends InfoExtractor {
  static IE_NAME = "bitchute";
  static IE_DESC = "BitChute";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — media_url progressive / HLS`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  private async callApi<T>(endpoint: string, videoId: string): Promise<T> {
    return this.request.json<T>(`https://api.bitchute.com/api/beta/${endpoint}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ video_id: videoId }),
    });
  }

  async extract(url: string): Promise<InfoDict> {
    const id = matchId(url, VALID_URL);
    const media = await this.callApi<BitChuteMediaResponse>("video/media", id);
    const mediaUrl = media.media_url;
    if (!mediaUrl) throw new Error(`No BitChute media_url for ${id}`);

    const formats: Format[] = /\.m3u8/i.test(mediaUrl)
      ? [hlsFormat(mediaUrl, "hls")]
      : [progressiveFormat(mediaUrl, { format_id: "http" })];

    let meta: BitChuteVideoResponse | null = null;
    try {
      meta = await this.callApi<BitChuteVideoResponse>("video", id);
    } catch {
      /* optional */
    }

    let duration: number | null = null;
    if (typeof meta?.duration === "number") duration = meta.duration;
    else if (typeof meta?.duration === "string") {
      const parts = meta.duration.split(":").map(Number);
      if (parts.every(n => Number.isFinite(n))) {
        duration = parts.reduce((acc, n) => acc * 60 + n, 0);
      }
    }

    return baseInfo("bitchute", url, {
      id,
      title: meta?.video_name || id,
      description: meta?.description || null,
      uploader: meta?.profile?.profile_name || meta?.channel?.channel_name || null,
      uploader_id: meta?.profile?.profile_id || meta?.channel?.channel_id || null,
      thumbnail: meta?.thumbnail_url,
      duration,
      formats,
    });
  }
}
