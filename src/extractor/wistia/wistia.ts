import { InfoExtractor } from "../../core/info-extractor";
import type { Format, InfoDict, Thumbnail } from "../../core/types";
import {
  baseInfo,
  hlsFormat,
  matchId,
  progressiveFormat,
} from "../_shared/helpers";

interface WistiaAsset {
  url?: string;
  status?: number;
  type?: string;
  ext?: string;
  width?: number;
  height?: number;
  size?: number;
  bitrate?: number;
  display_name?: string;
  container?: string;
  codec?: string;
}

interface WistiaMedia {
  hashedId?: string;
  name?: string;
  seoDescription?: string;
  duration?: number;
  assets?: WistiaAsset[];
}

interface WistiaEmbedConfig {
  error?: string;
  media?: WistiaMedia;
}

export class WistiaIE extends InfoExtractor {
  static IE_NAME = "wistia";
  static IE_DESC = "Wistia embeds";
  static readonly _VALID_URL =
    /(?:wistia:|https?:\/\/(?:\w+\.)?wistia\.(?:net|com)\/(?:embed\/)?(?:iframe|medias)\/)(?<id>[a-z0-9]{10})/i;

  async extract(url: string): Promise<InfoDict> {
    const id = matchId(url, WistiaIE._VALID_URL);
    const embedUrl = `http://fast.wistia.net/embed/medias/${id}.json`;
    const config = await this.request.json<WistiaEmbedConfig>(embedUrl, {
      headers: {
        Referer: url.startsWith("http") ? url : embedUrl,
      },
    });

    if (config.error) {
      throw new Error(`Wistia error: ${config.error}`);
    }

    const media = config.media;
    if (!media?.assets?.length) {
      throw new Error(`Wistia media ${id} has no assets`);
    }

    const formats: Format[] = [];
    const thumbnails: Thumbnail[] = [];

    for (const asset of media.assets) {
      const aurl = asset.url;
      if (!aurl) continue;
      if (asset.status != null && asset.status !== 2) continue;
      const atype = asset.type || "";
      if (atype === "preview" || atype === "storyboard") continue;

      if (atype === "still" || atype === "still_image") {
        thumbnails.push({
          url: aurl.replace(/\.bin(\?|$)/i, ".jpg$1"),
          width: asset.width,
          height: asset.height,
        });
        continue;
      }

      const isHls =
        asset.container === "m3u8" ||
        asset.ext === "m3u8" ||
        /\.m3u8(\?|$)/i.test(aurl);

      if (isHls) {
        formats.push(
          hlsFormat(aurl.replace(/\.bin(\?|$)/i, ".m3u8$1"), atype || "hls"),
        );
      } else {
        const isAudio = asset.display_name === "Audio";
        formats.push(
          progressiveFormat(aurl, {
            format_id: atype || "http",
            ext: asset.ext || undefined,
            width: asset.width ?? null,
            height: asset.height ?? null,
            tbr: asset.bitrate ?? null,
            filesize: asset.size ?? null,
            has_video: !isAudio,
            vcodec: isAudio ? "none" : asset.codec || "unknown",
          }),
        );
      }
    }

    if (!formats.length) {
      throw new Error(`Wistia media ${id} has no playable formats`);
    }

    return baseInfo(WistiaIE.IE_NAME, url, {
      id: media.hashedId || id,
      title: media.name || id,
      description: media.seoDescription || null,
      duration: media.duration ?? null,
      thumbnail: thumbnails[0]?.url,
      thumbnails: thumbnails.length ? thumbnails : undefined,
      formats,
    });
  }
}
