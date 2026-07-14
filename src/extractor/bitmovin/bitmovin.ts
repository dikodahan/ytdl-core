import { InfoExtractor } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import { baseInfo, dashFormat, hlsFormat, matchId } from "../_shared/helpers";

interface BitmovinConfig {
  sources?: {
    hls?: string;
    dash?: string;
    title?: string;
    poster?: string;
  };
  title?: string;
  poster?: string;
}

export class BitmovinIE extends InfoExtractor {
  static IE_NAME = "bitmovin";
  static IE_DESC = "Bitmovin Streams embeds";
  static readonly _VALID_URL = /https?:\/\/streams\.bitmovin\.com\/(?<id>\w+)/i;

  async extract(url: string): Promise<InfoDict> {
    const id = matchId(url, BitmovinIE._VALID_URL);
    const config = await this.request.json<BitmovinConfig>(
      `https://streams.bitmovin.com/${id}/config`,
    );
    const sources = config.sources || {};
    const formats: Format[] = [];

    if (sources.hls) formats.push(hlsFormat(sources.hls));
    if (sources.dash) formats.push(dashFormat(sources.dash));

    if (!formats.length) {
      throw new Error(`Bitmovin stream ${id} has no HLS/DASH sources`);
    }

    return baseInfo(BitmovinIE.IE_NAME, url, {
      id,
      title: sources.title || config.title || id,
      thumbnail: sources.poster || config.poster || `https://streams.bitmovin.com/${id}/poster`,
      formats,
    });
  }
}
