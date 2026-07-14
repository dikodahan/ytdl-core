import { InfoExtractor } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  extractJsonObject,
  hlsFormat,
  matchId,
  progressiveFormat,
} from "../_shared/helpers";

interface VoxSetup {
  title?: string;
  player_setup?: {
    title?: string;
    video?: {
      title_short?: string;
      description_long?: string;
      description_short?: string;
      brightcove_thumbnail?: string;
      formatted_metadata?: { thumbnail?: string };
      youtube_id?: string;
    };
  };
  video?: {
    title_short?: string;
    description_long?: string;
    description_short?: string;
    brightcove_thumbnail?: string;
    formatted_metadata?: { thumbnail?: string };
  };
  embed_assets?: {
    chorus?: {
      hls_url?: string;
      mp4_url?: string;
      duration?: number;
    };
  };
}

export class VoxMediaIE extends InfoExtractor {
  static IE_NAME = "voxmedia";
  static IE_DESC = "Vox Media Volume embeds";
  static readonly _VALID_URL =
    /https?:\/\/volume\.vox-cdn\.com\/embed\/(?<id>[0-9a-f]{9})/i;

  async extract(url: string): Promise<InfoDict> {
    const id = matchId(url, VoxMediaIE._VALID_URL);
    const webpage = await this.request.text(url);

    const setupMatch = webpage.match(/setup\s*=\s*/);
    if (!setupMatch || setupMatch.index == null) {
      throw new Error(`Could not find Volume setup for ${id}`);
    }
    const brace = webpage.indexOf("{", setupMatch.index);
    const setup = extractJsonObject(webpage, brace) as VoxSetup | null;
    if (!setup) throw new Error(`Could not parse Volume setup for ${id}`);

    const playerSetup = setup.player_setup || setup;
    const videoData = playerSetup.video || setup.video || {};
    const formatted = videoData.formatted_metadata || {};
    const asset = setup.embed_assets?.chorus || {};

    const formats: Format[] = [];
    if (asset.hls_url) formats.push(hlsFormat(asset.hls_url));
    if (asset.mp4_url) {
      const tbr = asset.mp4_url.match(/-(\d+)k\./)?.[1];
      formats.push(
        progressiveFormat(asset.mp4_url, {
          format_id: tbr ? `http-${tbr}` : "http",
          tbr: tbr ? Number(tbr) : null,
        }),
      );
    }

    if (!formats.length) {
      const yt = videoData && "youtube_id" in videoData
        ? (videoData as { youtube_id?: string }).youtube_id
        : undefined;
      throw new Error(
        yt
          ? `Volume embed ${id} only references YouTube ${yt}; use the youtube extractor`
          : `Volume embed ${id} has no HLS/MP4 assets`,
      );
    }

    return baseInfo(VoxMediaIE.IE_NAME, url, {
      id,
      title: playerSetup.title || videoData.title_short || id,
      description:
        videoData.description_long || videoData.description_short || null,
      thumbnail: formatted.thumbnail || videoData.brightcove_thumbnail,
      duration: asset.duration ?? null,
      formats,
    });
  }
}
