import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  hlsFormat,
  progressiveFormat,
} from "../_shared/helpers";

const VALID_URL =
  /^https?(?<permalink>:\/\/(?:www\.)?nbc\.com\/(?:classic-tv\/)?[^/?#]+\/video\/[^/?#]+\/(?<id>\w+))/i;

const M3U8_DRM_RE =
  /https?:\/\/[^/?#]+\/prod\/[\w-]+\/(?<folders>[^?#]+\/)cmaf\/mpeg_(?:cbcs|cenc)\w*\/master_cmaf\w*\.m3u8/i;

interface NbcGraphqlMeta {
  description?: string;
  episodeNumber?: number;
  locked?: boolean;
  mpxAccountId?: string;
  mpxGuid?: string;
  secondaryTitle?: string;
  seriesShortTitle?: string;
  seasonNumber?: number;
  resourceId?: string;
  rating?: string;
}

function extractSmilSrc(smil: string): string | null {
  const m = smil.match(/<(?:video|ref)\b[^>]*\bsrc=["']([^"']+)["']/i);
  return m?.[1] || null;
}

function extractSmilError(smil: string): { exception?: string; abstract?: string } {
  const exception = smil.match(/<param[^>]+name=["']exception["'][^>]+value=["']([^"']+)/i)?.[1]
    || smil.match(/<param[^>]+value=["']([^"']+)["'][^>]+name=["']exception["']/i)?.[1];
  const abstract = smil.match(/<ref\b[^>]*\babstract=["']([^"']+)/i)?.[1];
  return { exception, abstract };
}

export class NbcIE extends InfoExtractor {
  static IE_NAME = "nbc";
  static IE_DESC = "NBC.com videos";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — HLS via thePlatform (US geo; DRM detected)`,
      validUrl: String(this._VALID_URL),
      options: [],
      notes: "US geo-restriction common; cable-locked titles require MVPD auth (unsupported).",
    };
  }

  private async downloadNbcuM3u8(
    tpPath: string,
    query: Record<string, string>,
  ): Promise<string> {
    const smilUrl = `https://link.theplatform.com/s/${tpPath}`;
    const smil = await this.request.text(smilUrl, {
      query: { mbr: "true", manifest: "m3u", ...query },
    });
    const err = extractSmilError(smil);
    if (err.exception === "GeoLocationBlocked") {
      throw new Error("NBC video is geo-restricted to the US");
    }
    if (err.exception) {
      throw new Error(err.abstract || `NBC/thePlatform error: ${err.exception}`);
    }
    const src = extractSmilSrc(smil);
    if (!src) throw new Error("NBC SMIL response contained no video src");
    if (src.includes("errorFiles/Unavailable")) {
      throw new Error("NBC video is unavailable");
    }
    return src;
  }

  async extract(url: string): Promise<InfoDict> {
    const m = url.match(VALID_URL);
    if (!m?.groups?.id || !m.groups.permalink) {
      throw new Error(`Could not extract id from URL: ${url}`);
    }
    let videoId = m.groups.id;
    const permalink = `http${decodeURIComponent(m.groups.permalink)}`;

    const gql = await this.request.json<{
      data?: { bonanzaPage?: { metadata?: NbcGraphqlMeta | null } };
    }>("https://friendship.nbc.co/v2/graphql", {
      query: {
        query: `query bonanzaPage($app: NBCUBrands! = nbc, $name: String!, $oneApp: Boolean, $platform: SupportedPlatforms! = web, $type: EntityPageType! = VIDEO, $userId: String!) {
  bonanzaPage(app: $app, name: $name, oneApp: $oneApp, platform: $platform, type: $type, userId: $userId) {
    metadata { ... on VideoPageData { description episodeNumber locked mpxAccountId mpxGuid rating resourceId seasonNumber secondaryTitle seriesShortTitle } }
  }
}`,
        variables: JSON.stringify({ name: permalink, oneApp: true, userId: "0" }),
      },
    });

    let videoData = gql.data?.bonanzaPage?.metadata;
    if (!videoData?.mpxGuid || !videoData.mpxAccountId) {
      throw new Error(`NBC GraphQL returned no video metadata for ${videoId}`);
    }
    if (videoData.locked) {
      throw new Error(
        "NBC video requires cable/MVPD authentication (DRM/auth); unsupported for VLC-only extract",
      );
    }

    videoId = videoData.mpxGuid;
    const tpPath = `NnzsPC/media/guid/${videoData.mpxAccountId}/${videoId}`;

    let m3u8Url: string;
    try {
      m3u8Url = await this.downloadNbcuM3u8(tpPath, { formats: "m3u+none,mpeg4" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/geo-restricted/i.test(msg)) throw e;
      throw new Error(msg);
    }

    const drmMatch = m3u8Url.match(M3U8_DRM_RE);
    if (drmMatch?.groups?.folders) {
      try {
        const tmpl = await this.downloadNbcuM3u8(tpPath, { formats: "mpeg4" });
        if (tmpl.includes("{folders}")) {
          m3u8Url = tmpl.replace("{folders}", drmMatch.groups.folders);
        } else if (!/mpeg_cenc|mpeg_cbcs/i.test(tmpl)) {
          m3u8Url = tmpl;
        }
      } catch {
        /* keep original */
      }
    }

    if (/\/mpeg_cenc|\/mpeg_cbcs/i.test(m3u8Url)) {
      throw new Error(`NBC video ${videoId} is DRM-protected`);
    }

    const formats: Format[] = [hlsFormat(m3u8Url)];

    // Preview metadata (best-effort)
    let title = videoData.secondaryTitle || videoId;
    let description = videoData.description || null;
    let thumbnail: string | undefined;
    let duration: number | null = null;
    try {
      const preview = await this.request.json<{
        title?: string;
        description?: string;
        defaultThumbnailUrl?: string;
        duration?: number;
      }>(`https://link.theplatform.com/s/${tpPath}`, { query: { format: "preview" } });
      title = preview.title || title;
      description = preview.description || description;
      thumbnail = preview.defaultThumbnailUrl;
      duration = preview.duration != null ? preview.duration / 1000 : null;
    } catch {
      /* optional */
    }

    // Also expose progressive if SMIL lists http
    try {
      const smil = await this.request.text(`https://link.theplatform.com/s/${tpPath}`, {
        query: { mbr: "true", format: "SMIL" },
      });
      for (const vm of smil.matchAll(/<(?:video|ref)\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
        const src = vm[1];
        if (!src || /\.m3u8(\?|$)/i.test(src)) continue;
        if (/^https?:/i.test(src) && !src.includes("errorFiles")) {
          formats.push(progressiveFormat(src));
        }
      }
    } catch {
      /* optional */
    }

    return baseInfo("nbc", url, {
      id: videoId,
      title,
      description,
      thumbnail,
      duration,
      series: videoData.seriesShortTitle || null,
      formats,
    });
  }
}
