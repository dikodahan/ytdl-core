import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  extractJsonObject,
  hlsFormat,
  matchId,
} from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?:www\.)?bloomberg\.com\/(?:[^/]+\/)*(?<id>[^/?#]+)/i;

interface BloombergStream {
  url?: string;
  muxing_format?: string;
}

interface BloombergEmbed {
  streams?: BloombergStream[];
}

function og(webpage: string, prop: string): string | null {
  return (
    webpage.match(new RegExp(`property=["']og:${prop}["']\\s+content=["']([^"']+)`, "i"))?.[1] ||
    webpage.match(new RegExp(`content=["']([^"']+)["']\\s+property=["']og:${prop}["']`, "i"))?.[1] ||
    null
  );
}

export class BloombergIE extends InfoExtractor {
  static IE_NAME = "bloomberg";
  static IE_DESC = "Bloomberg.com videos";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — HLS streams`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const name = matchId(url, VALID_URL);
    const webpage = await this.request.text(url);

    let videoId =
      webpage.match(/["']bmmrId["']\s*:\s*["'](?<id>[^"']+)["']/i)?.groups?.id ||
      webpage.match(/videoId\s*:\s*["'](?<id>[^"']+)["']/i)?.groups?.id ||
      webpage.match(/data-bmmrid=["'](?<id>[^"']+)["']/i)?.groups?.id ||
      null;

    if (!videoId) {
      const bp = webpage.match(/BPlayer\(\s*null\s*,\s*/i);
      if (bp && bp.index != null) {
        const brace = webpage.indexOf("{", bp.index);
        const data = extractJsonObject(webpage, brace) as { id?: string } | null;
        videoId = data?.id || null;
      }
    }
    if (!videoId) throw new Error(`Could not find Bloomberg video id on ${name}`);

    const embed = await this.request.json<BloombergEmbed>(
      `https://www.bloomberg.com/multimedia/api/embed?id=${encodeURIComponent(videoId)}`,
    );

    const formats: Format[] = [];
    for (const stream of embed.streams || []) {
      if (!stream.url) continue;
      if (stream.muxing_format === "TS" || /\.m3u8(\?|$)/i.test(stream.url)) {
        formats.push(hlsFormat(stream.url));
      }
      // Skip HDS/f4m — not useful for VLC-oriented extract
    }

    if (!formats.length) {
      throw new Error(`Bloomberg video ${videoId} has no HLS streams`);
    }

    const title = (og(webpage, "title") || name).replace(/: Video$/i, "");

    return baseInfo("bloomberg", url, {
      id: videoId,
      title,
      description: og(webpage, "description"),
      thumbnail: og(webpage, "image") || undefined,
      formats,
    });
  }
}
