import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import { baseInfo, matchId, progressiveFormat } from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?:www\.)?reverbnation\.com\/.*?\/song\/(?<id>\d+)/i;

interface ReverbNationSong {
  name?: string;
  url?: string;
  thumbnail?: string;
  image?: string;
  artist?: { name?: string; id?: number | string };
}

export class ReverbNationIE extends InfoExtractor {
  static IE_NAME = "reverbnation";
  static IE_DESC = "ReverbNation songs";
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
    const songId = matchId(url, VALID_URL);
    const api = await this.request.json<ReverbNationSong>(
      `https://api.reverbnation.com/song/${songId}`,
    );

    if (!api.url) throw new Error(`No stream URL for ReverbNation song ${songId}`);

    const formats: Format[] = [
      progressiveFormat(api.url, {
        format_id: "http",
        ext: "mp3",
        has_video: false,
        vcodec: "none",
        acodec: "mp3",
      }),
    ];

    return baseInfo("reverbnation", url, {
      id: songId,
      title: api.name || songId,
      uploader: api.artist?.name || null,
      uploader_id: api.artist?.id != null ? String(api.artist.id) : null,
      thumbnail: api.image || api.thumbnail,
      formats,
    });
  }
}
