import { createHash } from "crypto";
import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import { baseInfo, progressiveFormat } from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/music\.yandex\.(?<tld>ru|kz|ua|by|com)\/album\/(?<album_id>\d+)\/track\/(?<id>\d+)/i;

interface YandexArtist {
  name?: string;
  decomposed?: Array<string | { name?: string }>;
}

interface YandexAlbum {
  title?: string;
  coverUri?: string;
  year?: number;
  genre?: string;
  artists?: YandexArtist[];
  trackPosition?: { volume?: number; index?: number };
}

interface YandexTrack {
  id?: number | string;
  title?: string;
  fileSize?: number;
  durationMs?: number;
  artists?: YandexArtist[];
  albums?: YandexAlbum[];
}

interface DownloadData {
  src?: string;
  codec?: string;
  bitrate?: number;
}

interface FdData {
  host?: string;
  path?: string;
  s?: string;
  ts?: string;
}

function extractArtistName(artist: YandexArtist): string | null {
  if (!artist.name) return null;
  const decomposed = artist.decomposed;
  if (!Array.isArray(decomposed)) return artist.name;
  const parts: string[] = [artist.name];
  for (const element of decomposed) {
    if (typeof element === "string") parts.push(element);
    else if (element && typeof element === "object" && element.name) {
      parts.push(element.name);
    }
  }
  return parts.join("");
}

function extractArtist(artists: YandexArtist[] | undefined): string | null {
  if (!artists?.length) return null;
  const names = artists.map(extractArtistName).filter((n): n is string => !!n);
  return names.length ? names.join(", ") : null;
}

export class YandexMusicIE extends InfoExtractor {
  static IE_NAME = "yandexmusic";
  static IE_DESC = "Yandex Music tracks";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — progressive mp3`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const m = url.match(VALID_URL);
    if (!m?.groups?.id || !m.groups.album_id || !m.groups.tld) {
      throw new Error(`Could not extract id from URL: ${url}`);
    }
    const tld = m.groups.tld;
    const albumId = m.groups.album_id;
    const trackId = m.groups.id;

    const trackResp = await this.request.json<{
      track?: YandexTrack;
      error?: string;
      type?: string;
      captcha?: unknown;
    }>(`https://music.yandex.${tld}/handlers/track.jsx`, {
      query: { track: `${trackId}:${albumId}` },
      headers: {
        Referer: url,
        "X-Requested-With": "XMLHttpRequest",
        "X-Retpath-Y": url,
      },
    });

    if (trackResp.error) throw new Error(trackResp.error);
    if (trackResp.type === "captcha" || trackResp.captcha != null) {
      throw new Error("Yandex Music CAPTCHA required — export cookies from music.yandex.ru");
    }

    const track = trackResp.track;
    if (!track) throw new Error(`No track data for Yandex Music ${trackId}`);

    const downloadData = await this.request.json<DownloadData>(
      `https://music.yandex.ru/api/v2.1/handlers/track/${trackId}:${albumId}/web-album_track-track-track-main/download/m`,
      {
        query: { hq: 1 },
        headers: { "X-Retpath-Y": url },
      },
    );
    if (!downloadData.src) {
      throw new Error(`No download location for Yandex Music ${trackId}`);
    }

    const fdData = await this.request.json<FdData>(downloadData.src, {
      query: { format: "json" },
    });
    if (!fdData.host || !fdData.path || !fdData.s || !fdData.ts) {
      throw new Error(`Incomplete download info for Yandex Music ${trackId}`);
    }

    const key = createHash("md5")
      .update(`XGRlBW9FXlekgbPrRHuSiA${fdData.path.slice(1)}${fdData.s}`)
      .digest("hex");
    const fUrl = `http://${fdData.host}/get-mp3/${key}/${fdData.ts}${fdData.path}?track-id=${track.id ?? trackId}`;

    const formats: Format[] = [
      progressiveFormat(fUrl, {
        format_id: "http",
        ext: "mp3",
        has_video: false,
        vcodec: "none",
        acodec: downloadData.codec || "mp3",
        tbr: downloadData.bitrate ?? null,
        filesize: track.fileSize ?? null,
      }),
    ];

    let thumbnail: string | undefined;
    const coverUri = track.albums?.[0]?.coverUri;
    if (coverUri) {
      thumbnail = coverUri.replace("%%", "orig");
      if (!thumbnail.startsWith("http")) thumbnail = `http://${thumbnail}`;
    }

    const trackTitle = track.title || trackId;
    const trackArtist = extractArtist(track.artists);
    const title = trackArtist ? `${trackArtist} - ${trackTitle}` : trackTitle;

    return baseInfo("yandexmusic", url, {
      id: trackId,
      title,
      uploader: trackArtist,
      duration: track.durationMs != null ? track.durationMs / 1000 : null,
      thumbnail,
      formats,
    });
  }
}
