import { InfoExtractor } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  hlsFormat,
  progressiveFormat,
} from "../_shared/helpers";

interface TpMetadata {
  title?: string;
  description?: string;
  defaultThumbnailUrl?: string;
  duration?: number;
  pubDate?: number;
  billingCode?: string;
}

export class ThePlatformIE extends InfoExtractor {
  static IE_NAME = "theplatform";
  static IE_DESC = "thePlatform / Paramount media links";
  static readonly _VALID_URL =
    /(?:https?:\/\/(?:link|player)\.theplatform\.com\/[sp]\/(?<provider>[^/]+)\/(?:(?:(?:[^/]+\/)+select\/)?(?<media>media\/(?:guid\/\d+\/)?)?|(?<config>(?:[^/?]+\/(?:swf|config)|onsite)\/select\/))?|theplatform:)(?<id>[^/?&]+)/i;

  async extract(url: string): Promise<InfoDict> {
    const m = url.match(ThePlatformIE._VALID_URL);
    if (!m?.groups?.id) throw new Error(`Could not extract thePlatform id from URL: ${url}`);

    const videoId = m.groups.id;
    const providerId = m.groups.provider || "dJ5BDC";
    let path = `${providerId}/`;
    if (m.groups.media) path += m.groups.media;
    path += videoId;

    const formats: Format[] = [];
    let meta: TpMetadata = {};

    try {
      meta = await this.request.json<TpMetadata>(
        `https://link.theplatform.com/s/${path}`,
        { query: { format: "preview" } },
      );
    } catch {
      /* preview metadata is best-effort */
    }

    const smilUrl = `https://link.theplatform.com/s/${path}?mbr=true&format=SMIL`;
    try {
      const smil = await this.request.text(smilUrl);
      for (const vm of smil.matchAll(/<(?:video|audio|ref)\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
        const src = vm[1];
        if (!src || src.includes("errorFiles/Unavailable")) continue;
        if (/\.m3u8(\?|$)/i.test(src)) formats.push(hlsFormat(src));
        else if (/^https?:/i.test(src)) formats.push(progressiveFormat(src));
        else if (/^rtmp/i.test(src)) {
          formats.push({
            format_id: "rtmp",
            url: src,
            ext: "flv",
            protocol: "rtmp",
            has_video: true,
            has_audio: true,
            vcodec: "unknown",
            acodec: "unknown",
          });
        }
      }
    } catch {
      /* SMIL may be geo-blocked */
    }

    // Direct HLS probe
    if (!formats.some(f => f.isHLS)) {
      const hlsProbe = `https://link.theplatform.com/s/${path}?mbr=true&manifest=m3u`;
      formats.push(hlsFormat(hlsProbe));
    }

    if (!formats.length) {
      throw new Error(`thePlatform media ${videoId} has no playable sources`);
    }

    return baseInfo(ThePlatformIE.IE_NAME, url, {
      id: videoId,
      title: meta.title || videoId,
      description: meta.description || null,
      thumbnail: meta.defaultThumbnailUrl,
      duration: meta.duration != null ? meta.duration / 1000 : null,
      timestamp: meta.pubDate != null ? Math.floor(meta.pubDate / 1000) : null,
      uploader: meta.billingCode || null,
      formats,
    });
  }
}
