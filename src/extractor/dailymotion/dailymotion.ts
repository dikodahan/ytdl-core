import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  hlsFormat,
  matchId,
  progressiveFormat,
} from "../_shared/helpers";

const VALID_URL =
  /^(?:https?:)?\/\/(?:dai\.ly\/|(?:(?:www|touch|geo)\.)?dailymotion\.[a-z]{2,3}\/(?:(?:embed|swf|crawler)\/)?video\/|www\.dailymotion\.com\/player(?:\/[\da-z]+)?\.html\?(?:video|playlist)=)(?<id>[^/?_&#]+)/i;

const CLIENT_ID = "f5a1436a495620be79207b4e189aceaf";
const CLIENT_SECRET = "eea605b96e01c796ff369935357eca920c5da4c5";

export class DailymotionIE extends InfoExtractor {
  static IE_NAME = "dailymotion";
  static IE_DESC = "Dailymotion";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — progressive + HLS`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  private async getAccessToken(videoId: string): Promise<string | null> {
    try {
      const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      });
      const res = await this.request.json<{ access_token?: string }>(
        "https://graphql.api.dailymotion.com/oauth/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        },
      );
      return res.access_token || null;
    } catch {
      // Fall back to yt-dlp neon client pair
      try {
        const body = new URLSearchParams({
          grant_type: "client_credentials",
          client_id: "f1a362d288c1b98099c7",
          client_secret: CLIENT_SECRET,
        });
        const res = await this.request.json<{ access_token?: string }>(
          "https://graphql.api.dailymotion.com/oauth/token",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
          },
        );
        return res.access_token || null;
      } catch {
        return null;
      }
    }
  }

  async extract(url: string): Promise<InfoDict> {
    const id = matchId(url, VALID_URL);
    const token = await this.getAccessToken(id);
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const metadata = await this.request.json<{
      title?: string;
      duration?: number;
      owner?: { screenname?: string; username?: string };
      posters?: Record<string, string>;
      error?: { title?: string; raw_message?: string; code?: string };
      qualities?: Record<string, Array<{ url?: string; type?: string }>>;
    }>(`https://www.dailymotion.com/player/metadata/video/${id}`, {
      query: { app: "com.dailymotion.neon" },
      headers,
    });

    if (metadata.error) {
      throw new Error(
        metadata.error.title || metadata.error.raw_message || "Dailymotion error",
      );
    }

    const formats: Format[] = [];
    for (const [quality, mediaList] of Object.entries(metadata.qualities || {})) {
      for (const m of mediaList || []) {
        const mediaUrl = m.url?.split("#")[0];
        if (!mediaUrl || m.type === "application/vnd.lumberjack.manifest") continue;
        if (m.type === "application/x-mpegURL" || /\.m3u8/i.test(mediaUrl)) {
          formats.push(hlsFormat(mediaUrl, `hls-${quality}`));
        } else {
          const dim = mediaUrl.match(/\/H264-(\d+)x(\d+)/);
          formats.push(
            progressiveFormat(mediaUrl, {
              format_id: `http-${quality}`,
              width: dim ? Number(dim[1]) : null,
              height: dim ? Number(dim[2]) : null,
            }),
          );
        }
      }
    }

    if (!formats.length) throw new Error(`No playable formats for Dailymotion video ${id}`);

    const posters = metadata.posters || {};
    const thumb =
      posters["720"] || posters["480"] || posters["360"] || Object.values(posters)[0];

    return baseInfo("dailymotion", url, {
      id,
      title: metadata.title || id,
      duration: metadata.duration ?? null,
      uploader: metadata.owner?.screenname || metadata.owner?.username || null,
      thumbnail: thumb,
      formats,
    });
  }
}
