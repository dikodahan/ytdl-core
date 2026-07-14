import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  hlsFormat,
  progressiveFormat,
} from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?:(?:www\.|m\.)?soundcloud\.com\/(?<uploader>[\w\d-]+)\/(?!tracks|albums|sets|reposts|likes|spotlight|comments)(?<title>[\w\d-]+)(?:\/(?<token>(?!(?:albums|sets|recommended))[^?]+?))?(?:[?].*)?$|api(?:-v2)?\.soundcloud\.com\/tracks\/(?:soundcloud%3Atracks%3A)?(?<track_id>\d+))/i;

const API_V2 = "https://api-v2.soundcloud.com/";

interface Transcoding {
  url?: string;
  preset?: string;
  format?: { protocol?: string; mime_type?: string };
}

interface TrackInfo {
  id?: number | string;
  title?: string;
  description?: string;
  duration?: number;
  artwork_url?: string;
  user?: { username?: string; permalink?: string; id?: number | string };
  media?: { transcodings?: Transcoding[] };
  permalink_url?: string;
}

export class SoundcloudIE extends InfoExtractor {
  static IE_NAME = "soundcloud";
  static IE_DESC = "SoundCloud";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — progressive + HLS audio`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  private async scrapeClientId(): Promise<string> {
    const homepage = await this.request.text("https://soundcloud.com/");
    const scripts = [...homepage.matchAll(/<script[^>]+src="([^"]+)"/gi)].map(m => m[1]);
    for (const src of scripts.reverse()) {
      if (!src) continue;
      try {
        const js = await this.request.text(src);
        const m = js.match(/client_id\s*:\s*"([0-9a-zA-Z]{32})"/);
        if (m?.[1]) return m[1];
      } catch {
        /* try next asset */
      }
    }
    throw new Error("Unable to extract SoundCloud client_id");
  }

  async extract(url: string): Promise<InfoDict> {
    const m = url.match(VALID_URL);
    if (!m) throw new Error(`Could not extract id from URL: ${url}`);

    const clientId = await this.scrapeClientId();
    let track: TrackInfo;

    if (m.groups?.track_id) {
      track = await this.request.json<TrackInfo>(`${API_V2}tracks/${m.groups.track_id}`, {
        query: { client_id: clientId },
      });
    } else {
      const uploader = m.groups!.uploader!;
      const title = m.groups!.title!;
      const token = m.groups?.token;
      const resolvePath = token ? `${uploader}/${title}/${token}` : `${uploader}/${title}`;
      track = await this.request.json<TrackInfo>(`${API_V2}resolve`, {
        query: { url: `https://soundcloud.com/${resolvePath}`, client_id: clientId },
      });
    }

    if (track.id == null) throw new Error("SoundCloud resolve returned no track id");
    const trackId = String(track.id);
    const formats: Format[] = [];

    for (const t of track.media?.transcodings || []) {
      if (!t.url || !t.preset) continue;
      let protocol = t.format?.protocol || "http";
      if (protocol.startsWith("ctr-") || protocol.startsWith("cbc-")) continue;
      if (protocol === "progressive") protocol = "http";
      if (protocol !== "hls" && /\/hls/i.test(t.url)) protocol = "hls";
      if (protocol === "encrypted-hls" || /encrypted-hls/i.test(t.url)) continue;
      if (t.preset.startsWith("abr")) continue;

      try {
        const stream = await this.request.json<{ url?: string }>(t.url, {
          query: { client_id: clientId },
        });
        if (!stream.url) continue;
        const formatId = `${protocol}_${t.preset.split("_")[0]}`;
        if (protocol === "hls" || /\.m3u8/i.test(stream.url)) {
          formats.push({
            ...hlsFormat(stream.url, formatId),
            has_video: false,
            vcodec: "none",
            acodec: "mp4a.40.2",
            ext: "m4a",
          });
        } else {
          formats.push(
            progressiveFormat(stream.url, {
              format_id: formatId,
              has_video: false,
              vcodec: "none",
              acodec: "mp3",
              ext: stream.url.includes(".mp3") ? "mp3" : "m4a",
            }),
          );
        }
      } catch {
        /* skip broken transcoding */
      }
    }

    if (!formats.length) throw new Error(`No playable formats for SoundCloud track ${trackId}`);

    return baseInfo("soundcloud", url, {
      id: trackId,
      title: track.title || trackId,
      description: track.description || null,
      duration: track.duration ? track.duration / 1000 : null,
      uploader: track.user?.username || null,
      uploader_id: track.user?.id != null ? String(track.user.id) : null,
      thumbnail: track.artwork_url?.replace("-large", "-t500x500") || undefined,
      formats,
    });
  }
}
