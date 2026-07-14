import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import { baseInfo, progressiveFormat } from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?:(?:(?:embed|www|shows)\.)?acast\.com\/|play\.acast\.com\/s\/)(?<channel>[^/?#]+)\/(?:episodes\/)?(?<id>[^/#?"]+)/i;

interface AcastShow {
  author?: string;
  title?: string;
}

interface AcastEpisode {
  id?: string;
  episodeUrl?: string;
  url?: string;
  title?: string;
  description?: string;
  summary?: string;
  image?: string;
  duration?: number;
  contentLength?: number;
  season?: number;
  episode?: number;
  show?: AcastShow;
}

function stripHtml(html: string | undefined): string | null {
  if (!html) return null;
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null;
}

export class AcastIE extends InfoExtractor {
  static IE_NAME = "acast";
  static IE_DESC = "Acast podcasts";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — progressive audio`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const m = url.match(VALID_URL);
    if (!m?.groups?.channel || !m.groups.id) {
      throw new Error(`Could not extract id from URL: ${url}`);
    }
    const channel = m.groups.channel;
    const displayId = m.groups.id;

    const episode = await this.request.json<AcastEpisode>(
      `https://feeder.acast.com/api/v1/shows/${channel}/episodes/${displayId}`,
      { query: { showInfo: "true" } },
    );

    if (!episode.url) throw new Error(`No stream URL for Acast episode ${displayId}`);

    const formats: Format[] = [
      progressiveFormat(episode.url, {
        format_id: "http",
        ext: "mp3",
        has_video: false,
        vcodec: "none",
        acodec: "mp3",
        filesize: episode.contentLength ?? null,
      }),
    ];

    return baseInfo("acast", url, {
      id: episode.id || displayId,
      display_id: episode.episodeUrl || displayId,
      title: episode.title || displayId,
      description: stripHtml(episode.description || episode.summary),
      thumbnail: episode.image,
      duration: episode.duration ?? null,
      uploader: episode.show?.author || null,
      formats,
    });
  }
}
