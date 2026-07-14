import * as crypto from "crypto";
import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import { baseInfo, progressiveFormat } from "../_shared/helpers";

/** Legacy `/song/user/slug` and current `/user/song/slug` share paths. */
const VALID_URL =
  /^https?:\/\/(?:www\.)?audiomack\.com\/(?:song\/(?<uploader>[\w-]+)\/(?<slug>[\w-]+)|(?<uploader2>[\w-]+)\/song\/(?<slug2>[\w-]+))/i;

const API_BASE = "https://api.audiomack.com/v1";
const CONSUMER_KEY = "audiomack-web";
const CONSUMER_SECRET = "bd8a07e9f23fbe9d808646b730f89b8e";

interface AudiomackSong {
  id?: number | string;
  artist?: string;
  title?: string;
  duration?: number | string;
  image?: string;
  description?: string;
  uploader?: { name?: string };
  is_soundcloud?: string | boolean;
  url?: string;
}

function oauthParams(method: string, url: string, extra: Record<string, string> = {}): Record<string, string> {
  const oauth: Record<string, string> = {
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: "1.0",
    ...extra,
  };
  const base = Object.keys(oauth)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauth[k]!)}`)
    .join("&");
  const baseString = [method.toUpperCase(), encodeURIComponent(url), encodeURIComponent(base)].join("&");
  const key = `${encodeURIComponent(CONSUMER_SECRET)}&`;
  oauth.oauth_signature = crypto.createHmac("sha1", key).update(baseString).digest("base64");
  return oauth;
}

export class AudiomackIE extends InfoExtractor {
  static IE_NAME = "audiomack";
  static IE_DESC = "Audiomack songs";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — progressive audio (OAuth API)`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  private async apiGet<T>(path: string, extraQuery: Record<string, string> = {}): Promise<T> {
    const url = `${API_BASE}${path}`;
    const oauth = oauthParams("GET", url, extraQuery);
    return this.request.json<T>(url, { query: oauth });
  }

  async extract(url: string): Promise<InfoDict> {
    const m = url.match(VALID_URL);
    const uploader = m?.groups?.uploader || m?.groups?.uploader2;
    const slug = m?.groups?.slug || m?.groups?.slug2;
    if (!uploader || !slug) throw new Error(`Could not parse Audiomack URL: ${url}`);

    const meta = await this.apiGet<{ results?: AudiomackSong }>(`/music/song/${uploader}/${slug}`);
    const song = meta.results;
    if (!song?.id) throw new Error(`Invalid Audiomack song ${uploader}/${slug}`);

    const play = await this.apiGet<{ signedUrl?: string; url?: string }>(`/music/play/${song.id}`);
    const streamUrl = play.signedUrl || play.url || song.url;
    if (!streamUrl) throw new Error(`No stream URL for Audiomack song ${song.id}`);

    // SoundCloud-wrapped tracks: return SC URL for the soundcloud extractor via error note.
    if (/soundcloud\.com/i.test(streamUrl)) {
      throw new Error(
        `Audiomack wraps a SoundCloud track — extract with service=soundcloud: ${streamUrl}`,
      );
    }

    const formats: Format[] = [
      progressiveFormat(streamUrl, {
        format_id: "http",
        ext: "mp3",
        has_video: false,
        vcodec: "none",
        acodec: "mp3",
      }),
    ];

    const duration =
      typeof song.duration === "string" ? Number(song.duration) : song.duration;

    return baseInfo("audiomack", url, {
      id: String(song.id),
      title: song.title || slug,
      description: song.description || null,
      uploader: song.artist || song.uploader?.name || uploader,
      thumbnail: song.image,
      duration: Number.isFinite(duration) ? duration! : null,
      formats,
    });
  }
}
