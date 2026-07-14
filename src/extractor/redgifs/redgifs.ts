import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import { baseInfo, matchId, progressiveFormat } from "../_shared/helpers";

const VALID_URL =
  /https?:\/\/(?:(?:www\.)?redgifs\.com\/(?:watch|ifr)\/|thumbs2\.redgifs\.com\/)(?<id>[^-/?#.]+)/i;

const FORMAT_HEIGHT: Record<string, number | null> = {
  gif: 250,
  sd: 480,
  hd: null,
};

interface RedGifData {
  id?: string;
  urls?: Record<string, string>;
  width?: number;
  height?: number;
  tags?: string[];
  createDate?: number;
  userName?: string;
  duration?: number;
  views?: number;
  likes?: number;
}

export class RedGifsIE extends InfoExtractor {
  static IE_NAME = "redgifs";
  static IE_DESC = "RedGifs";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — progressive mp4`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  private async fetchToken(videoId: string): Promise<string> {
    const auth = await this.request.json<{ token?: string }>(
      "https://api.redgifs.com/v2/auth/temporary",
    );
    if (!auth.token) throw new Error(`Unable to get RedGifs token for ${videoId}`);
    return auth.token;
  }

  private async callApi(
    ep: string,
    videoId: string,
    token: string,
  ): Promise<{ gif?: RedGifData; error?: string }> {
    return this.request.json(`https://api.redgifs.com/v2/${ep}`, {
      headers: {
        authorization: `Bearer ${token}`,
        referer: "https://www.redgifs.com/",
        origin: "https://www.redgifs.com",
        "content-type": "application/json",
        "x-customheader": `https://www.redgifs.com/watch/${videoId}`,
      },
    });
  }

  async extract(url: string): Promise<InfoDict> {
    const videoId = matchId(url, VALID_URL).toLowerCase();
    let token = await this.fetchToken(videoId);
    let data: { gif?: RedGifData; error?: string };
    try {
      data = await this.callApi(`gifs/${videoId}?views=yes`, videoId, token);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status !== 401) throw err;
      token = await this.fetchToken(videoId);
      data = await this.callApi(`gifs/${videoId}?views=yes`, videoId, token);
    }
    if (data.error) throw new Error(`RedGifs said: ${data.error}`);
    const gif = data.gif;
    if (!gif?.urls) throw new Error(`RedGifs ${videoId} missing urls`);

    const origHeight = gif.height || 0;
    const aspect = origHeight && gif.width ? gif.width / origHeight : null;
    const formats: Format[] = [];
    for (const [formatId, heightHint] of Object.entries(FORMAT_HEIGHT)) {
      const videoUrl = gif.urls[formatId];
      if (!videoUrl) continue;
      const height = Math.min(origHeight || heightHint || 0, heightHint || origHeight || 0) || null;
      formats.push(
        progressiveFormat(videoUrl, {
          format_id: formatId,
          width: aspect && height ? Math.round(height * aspect) : gif.width ?? null,
          height,
          ext: formatId === "gif" ? "gif" : "mp4",
        }),
      );
    }

    if (!formats.length) throw new Error(`No playable formats for RedGifs ${videoId}`);

    return baseInfo(RedGifsIE.IE_NAME, url, {
      id: gif.id || videoId,
      title: (gif.tags || []).join(" ") || "RedGifs",
      uploader: gif.userName || null,
      timestamp: gif.createDate ?? null,
      duration: gif.duration ?? null,
      view_count: gif.views ?? null,
      like_count: gif.likes ?? null,
      age_limit: 18,
      tags: gif.tags,
      formats,
    });
  }
}
