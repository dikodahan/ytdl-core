import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  matchId,
  progressiveFormat,
  tryParseJson,
} from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?<uploader>[\w-]+)\.bandcamp\.com\/track\/(?<id>[^/?#&]+)/i;

interface TralbumTrack {
  title?: string;
  track_id?: number | string;
  id?: number | string;
  duration?: number;
  file?: Record<string, string>;
}

interface Tralbum {
  trackinfo?: TralbumTrack[];
  current?: { title?: string; artist?: string };
  artist?: string;
  art_id?: number;
}

function unescapeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractDataAttr(html: string, attr: string): unknown | null {
  // Prefer exact attribute; Bandcamp HTML-escapes JSON as &quot;…
  const marker = `data-${attr}="`;
  const start = html.indexOf(marker);
  if (start < 0) {
    const markerSq = `data-${attr}='`;
    const startSq = html.indexOf(markerSq);
    if (startSq < 0) return null;
    const from = startSq + markerSq.length;
    const end = html.indexOf("'", from);
    if (end < 0) return null;
    return tryParseJson(unescapeHtml(html.slice(from, end)));
  }
  const from = start + marker.length;
  const end = html.indexOf('"', from);
  if (end < 0) return null;
  return tryParseJson(unescapeHtml(html.slice(from, end)));
}

export class BandcampIE extends InfoExtractor {
  static IE_NAME = "bandcamp";
  static IE_DESC = "Bandcamp tracks";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — mp3-128 progressive`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const slug = matchId(url, VALID_URL);
    const uploaderId = url.match(VALID_URL)?.groups?.uploader || null;
    const webpage = await this.request.text(url);
    const tralbum = extractDataAttr(webpage, "tralbum") as Tralbum | null;
    if (!tralbum) throw new Error(`Could not parse Bandcamp tralbum data for ${slug}`);

    const trackInfo = tralbum.trackinfo?.[0];
    if (!trackInfo) throw new Error(`No trackinfo on Bandcamp page ${slug}`);

    const formats: Format[] = [];
    const file = trackInfo.file;
    if (file && typeof file === "object") {
      for (const [formatId, formatUrl] of Object.entries(file)) {
        if (!formatUrl || typeof formatUrl !== "string") continue;
        const abs = formatUrl.startsWith("//") ? `https:${formatUrl}` : formatUrl;
        if (!/^https?:/i.test(abs)) continue;
        const [ext, abrStr] = formatId.split("-", 2);
        formats.push(
          progressiveFormat(abs, {
            format_id: formatId,
            ext: ext || "mp3",
            has_video: false,
            vcodec: "none",
            acodec: ext || "mp3",
            tbr: abrStr ? Number(abrStr) || null : null,
          }),
        );
      }
    }

    if (!formats.length) throw new Error(`No playable formats for Bandcamp track ${slug}`);

    const trackId = String(trackInfo.track_id ?? trackInfo.id ?? slug);
    const trackTitle = trackInfo.title || tralbum.current?.title || slug;
    const artist = tralbum.current?.artist || tralbum.artist || uploaderId;
    const title = artist ? `${artist} - ${trackTitle}` : trackTitle;

    let thumbnail: string | undefined;
    const ogThumb = webpage.match(/property="og:image"[^>]+content="([^"]+)"/i)?.[1]
      || webpage.match(/content="([^"]+)"[^>]+property="og:image"/i)?.[1];
    if (ogThumb) thumbnail = ogThumb;

    return baseInfo("bandcamp", url, {
      id: trackId,
      display_id: slug,
      title,
      uploader: artist || null,
      uploader_id: uploaderId,
      duration: trackInfo.duration ?? null,
      thumbnail,
      formats,
    });
  }
}
