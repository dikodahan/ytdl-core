import { InfoExtractor } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  extractJsonObject,
  hlsFormat,
  progressiveFormat,
  tryParseJson,
} from "../_shared/helpers";

export class BunnyCdnIE extends InfoExtractor {
  static IE_NAME = "bunnycdn";
  static IE_DESC = "Bunny Stream / Media Delivery embeds";
  static readonly _VALID_URL =
    /https?:\/\/(?:(?:iframe|player)\.mediadelivery\.net|video\.bunnycdn\.com)\/(?:embed|play)\/(?<library>\d+)\/(?<id>[\da-f-]+)/i;

  async extract(url: string): Promise<InfoDict> {
    const m = url.match(BunnyCdnIE._VALID_URL);
    if (!m?.groups) throw new Error(`Could not extract BunnyCDN ids from URL: ${url}`);
    const { library, id } = m.groups;

    const qs = new URL(url.startsWith("http") ? url : `https://x/${url}`).searchParams;
    const embedUrl = new URL(`https://iframe.mediadelivery.net/embed/${library}/${id}`);
    const token = qs.get("token");
    const expires = qs.get("expires");
    if (token) embedUrl.searchParams.set("token", token);
    if (expires) embedUrl.searchParams.set("expires", expires);

    const webpage = await this.request.text(embedUrl.toString(), {
      headers: {
        Referer: "https://iframe.mediadelivery.net/",
      },
    });

    const titleHint = webpage.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    if (titleHint === "403") {
      throw new Error(
        "This BunnyCDN video is inaccessible. A Referer header may be required.",
      );
    }
    if (titleHint === "404") {
      throw new Error("This BunnyCDN video does not exist");
    }

    const formats: Format[] = [];
    const headers = { Referer: url };

    // HTML5 <source> / video src
    for (const sm of webpage.matchAll(
      /<(?:source|video)[^>]+src=["']([^"']+)["']/gi,
    )) {
      const src = sm[1];
      if (/\.m3u8(\?|$)/i.test(src)) formats.push(hlsFormat(src));
      else if (/^https?:/i.test(src)) formats.push(progressiveFormat(src));
    }

    const originalUrl = webpage.match(
      /(?:var|const|let)\s+originalUrl\s*=\s*["']([^"']+)["']/,
    )?.[1];
    if (originalUrl && /^https?:/i.test(originalUrl)) {
      formats.push(progressiveFormat(originalUrl, { format_id: "source" }));
    }

    const srcUrl = webpage.match(
      /\.setAttribute\(\s*['"]src['"]\s*,\s*['"]([^'"]+)['"]\s*\)/,
    )?.[1];
    if (srcUrl && /\.m3u8(\?|$)/i.test(srcUrl)) {
      formats.push(hlsFormat(srcUrl));
    }

    // JSON-LD
    let title: string | undefined;
    let thumbnail: string | undefined;
    let duration: number | null = null;
    let description: string | null = null;

    for (const ld of webpage.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    )) {
      const json = tryParseJson<Record<string, unknown>>(ld[1]);
      if (!json) continue;
      if (typeof json.name === "string") title = json.name;
      if (typeof json.description === "string") description = json.description;
      if (typeof json.thumbnailUrl === "string") thumbnail = json.thumbnailUrl;
      if (typeof json.duration === "string") {
        const dm = json.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/i);
        if (dm) {
          duration =
            Number(dm[1] || 0) * 3600 + Number(dm[2] || 0) * 60 + Number(dm[3] || 0);
        }
      }
      const contentUrl = json.contentUrl;
      if (typeof contentUrl === "string") {
        if (/\.m3u8(\?|$)/i.test(contentUrl)) formats.push(hlsFormat(contentUrl));
        else formats.push(progressiveFormat(contentUrl));
      }
    }

    // plyr config on #main-video
    const plyr = webpage.match(/data-plyr-config=(["'])([\s\S]*?)\1/);
    if (plyr?.[2]) {
      const cfg = tryParseJson<{ title?: string }>(plyr[2].replace(/&quot;/g, '"'));
      if (cfg?.title) title = title || cfg.title;
    }
    const poster = webpage.match(/data-poster=(["'])([^"']+)\1/)?.[2];
    if (poster) thumbnail = thumbnail || poster;

    // Fallback: any m3u8 / mp4 in page
    if (!formats.length) {
      const brace = webpage.indexOf('"video"');
      if (brace >= 0) {
        const objStart = webpage.indexOf("{", Math.max(0, brace - 40));
        if (objStart >= 0) extractJsonObject(webpage, objStart);
      }
      for (const hm of webpage.matchAll(/https?:\/\/[^"'\\\s]+\/playlist\.m3u8[^"'\\\s]*/gi)) {
        formats.push(hlsFormat(hm[0]));
      }
      for (const pm of webpage.matchAll(/https?:\/\/[^"'\\\s]+\.mp4[^"'\\\s]*/gi)) {
        formats.push(progressiveFormat(pm[0]));
      }
    }

    if (!formats.length) {
      throw new Error(`BunnyCDN video ${id} has no playable sources`);
    }

    // Attach referer preference for progressive hosts that require it
    for (const f of formats) {
      f.http_headers = headers;
    }

    return baseInfo(BunnyCdnIE.IE_NAME, url, {
      id,
      title: title || titleHint || id,
      description,
      thumbnail,
      duration,
      formats,
    });
  }
}
