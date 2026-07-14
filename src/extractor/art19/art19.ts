import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import { baseInfo, matchId, progressiveFormat } from "../_shared/helpers";

const UUID = "[\\da-f]{8}-?[\\da-f]{4}-?[\\da-f]{4}-?[\\da-f]{4}-?[\\da-f]{12}";
const VALID_URL = new RegExp(
  `^https?:\\/\\/(?:(?:www\\.)?art19\\.com\\/shows\\/[^/#?]+\\/episodes\\/(?<id>${UUID})|rss\\.art19\\.com\\/episodes\\/(?<id2>${UUID})\\.mp3)`,
  "i",
);

interface Art19PlayerEpisode {
  title?: string;
  description_plain?: string;
  episode_number?: number;
  series_id?: string;
}

interface Art19RssContent {
  episode_title?: string;
  episode_description_plain?: string;
  episode_number?: number;
  series_title?: string;
  series_id?: string;
  cover_image?: string;
  duration?: number;
  media?: Record<string, { url?: string }>;
}

export class Art19IE extends InfoExtractor {
  static IE_NAME = "art19";
  static IE_DESC = "ART19 podcast episodes";
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
    const episodeId = m?.groups?.id || m?.groups?.id2 || matchId(url, VALID_URL);
    if (!episodeId) throw new Error(`Could not extract id from URL: ${url}`);

    let player: { episode?: Art19PlayerEpisode } | null = null;
    let rss: { content?: Art19RssContent } | null = null;

    try {
      player = await this.request.json<{ episode?: Art19PlayerEpisode }>(
        `https://art19.com/episodes/${episodeId}`,
        { headers: { Accept: "application/vnd.art19.v0+json" } },
      );
    } catch {
      /* optional */
    }

    try {
      rss = await this.request.json<{ content?: Art19RssContent }>(
        `https://rss.art19.com/episodes/${episodeId}.json`,
      );
    } catch {
      /* optional */
    }

    const formats: Format[] = [
      progressiveFormat(`https://rss.art19.com/episodes/${episodeId}.mp3`, {
        format_id: "direct",
        ext: "mp3",
        has_video: false,
        vcodec: "none",
        acodec: "mp3",
      }),
    ];

    const media = rss?.content?.media;
    if (media && typeof media === "object") {
      for (const [fmtId, fmtData] of Object.entries(media)) {
        if (fmtId === "waveform_bin" || !fmtData?.url) continue;
        formats.push(
          progressiveFormat(fmtData.url, {
            format_id: fmtId,
            has_video: false,
            vcodec: "none",
            acodec: fmtId,
          }),
        );
      }
    }

    const title =
      player?.episode?.title || rss?.content?.episode_title || episodeId;

    return baseInfo("art19", url, {
      id: episodeId,
      title,
      description:
        player?.episode?.description_plain ||
        rss?.content?.episode_description_plain ||
        null,
      duration: rss?.content?.duration ?? null,
      thumbnail: rss?.content?.cover_image,
      formats,
    });
  }
}
