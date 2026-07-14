import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  extractJsonObject,
  hlsFormat,
  progressiveFormat,
  tryParseJson,
} from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?:(?:video|player)\.pbs\.org\/(?:widget\/)?partnerplayer\/(?<player_id>[^/?#]+)|(?:(?:www|video|player)\.)?pbs\.org\/(?:(?:vir|port)alplayer|video)\/(?<id>[0-9]+)(?:[?/#]|$)|(?:www\.)?(?:pbs|thirteen|wgbh|wnet)\.org\/(?:[^/?#]+\/){1,5}(?<presumptive_id>[^/?#]+?)(?:\.html)?\/?(?:$|[?#]))/i;

interface PbsEncoding {
  url?: string;
  eeid?: string;
}

interface PbsVideoData {
  id?: string | number;
  contentID?: string | number;
  title?: string;
  description?: string;
  duration?: number;
  recommended_encoding?: PbsEncoding;
  alternate_encoding?: PbsEncoding;
  encodings?: Array<string | PbsEncoding>;
  image_url?: string;
  program?: { title?: string };
}

function og(webpage: string, prop: string): string | null {
  return (
    webpage.match(new RegExp(`property=["']og:${prop}["']\\s+content=["']([^"']+)`, "i"))?.[1] ||
    webpage.match(new RegExp(`content=["']([^"']+)["']\\s+property=["']og:${prop}["']`, "i"))?.[1] ||
    null
  );
}

function extractVideoData(html: string): PbsVideoData | null {
  const m =
    html.match(/PBS\.videoData\s*=\s*/) ||
    html.match(/window\.videoBridge\s*=\s*/);
  if (!m || m.index == null) return null;
  const brace = html.indexOf("{", m.index);
  if (brace < 0) return null;
  return extractJsonObject(html, brace) as PbsVideoData | null;
}

export class PbsIE extends InfoExtractor {
  static IE_NAME = "pbs";
  static IE_DESC = "PBS / member stations";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — HLS / progressive (US geo)`,
      validUrl: String(this._VALID_URL),
      options: [],
      notes: "Often geo-restricted to the US.",
    };
  }

  private async resolveVideoId(url: string): Promise<{
    videoId: string;
    displayId: string;
    description: string | null;
  }> {
    const m = url.match(VALID_URL);
    if (!m?.groups) throw new Error(`Could not extract id from URL: ${url}`);

    if (m.groups.id) {
      return { videoId: m.groups.id, displayId: m.groups.id, description: null };
    }

    if (m.groups.player_id) {
      const player = await this.request.text(url);
      const data = extractVideoData(player);
      const videoId =
        player.match(/<div\s+id=["']video_(\d+)/i)?.[1] ||
        (data?.id != null ? String(data.id) : null) ||
        (data?.contentID != null ? String(data.contentID) : null);
      if (!videoId) throw new Error(`Could not find PBS video id in player ${m.groups.player_id}`);
      return { videoId, displayId: m.groups.player_id, description: data?.description || null };
    }

    const displayId = m.groups.presumptive_id!;
    const webpage = await this.request.text(url);
    const description = og(webpage, "description");
    const mediaPatterns = [
      /\\"videoTPMediaId\\":\\"(\d+)\\"/,
      /\bhttps?:\/\/player\.pbs\.org\/[\w-]+player\/(\d+)/i,
      /<iframe[^>]+\bsrc=["'](?:https?:)?\/\/video\.pbs\.org\/widget\/partnerplayer\/(\d+)/i,
      /<div[^>]+\bdata-cove-id=["'](\d+)/i,
      /data-media=["'](\d+)/i,
      /id="pbs_video_id_[0-9]+"\s+value="([0-9]+)"/,
      /PBS\.playerConfig\s*=\s*{[\s\S]*?\bid\s*:\s*'([0-9]+)'/,
    ];
    for (const re of mediaPatterns) {
      const hit = webpage.match(re);
      if (hit?.[1]) return { videoId: hit[1], displayId, description };
    }
    throw new Error(`Could not find PBS media id on page ${displayId}`);
  }

  async extract(url: string): Promise<InfoDict> {
    const { videoId, displayId, description } = await this.resolveVideoId(url);

    const redirects: PbsEncoding[] = [];
    const seen = new Set<string>();
    let info: PbsVideoData = {};

    for (const page of ["widget/partnerplayer", "portalplayer"] as const) {
      let player: string;
      try {
        player = await this.request.text(`https://player.pbs.org/${page}/${videoId}`);
      } catch {
        continue;
      }
      const videoInfo = extractVideoData(player);
      if (!videoInfo) continue;
      if (!info.title) info = videoInfo;
      for (const enc of [
        videoInfo.recommended_encoding,
        videoInfo.alternate_encoding,
        ...(Array.isArray(videoInfo.encodings)
          ? videoInfo.encodings.map(e => (typeof e === "string" ? { url: e } : e))
          : []),
      ]) {
        if (enc?.url && !seen.has(enc.url)) {
          seen.add(enc.url);
          redirects.push(enc);
        }
      }
    }

    if (!redirects.length) {
      throw new Error(`PBS video ${videoId} has no encodings (possibly geo-restricted to US)`);
    }

    const formats: Format[] = [];
    let geoError: string | null = null;

    for (const redirect of redirects) {
      const redirectUrl = redirect.url!;
      let redirectInfo: { status?: string; http_code?: number; message?: string; url?: string };
      try {
        redirectInfo = await this.request.json(`${redirectUrl}${redirectUrl.includes("?") ? "&" : "?"}format=json`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/HTTP 403/.test(msg)) geoError = msg;
        continue;
      }
      if (redirectInfo.status === "error") {
        if (redirectInfo.http_code === 403) {
          geoError = redirectInfo.message || "geo-restricted";
          continue;
        }
        throw new Error(`pbs said: ${redirectInfo.message || "error"}`);
      }
      const formatUrl = redirectInfo.url;
      if (!formatUrl) continue;
      if (/\.m3u8(\?|$)/i.test(formatUrl)) formats.push(hlsFormat(formatUrl));
      else formats.push(progressiveFormat(formatUrl, { format_id: redirect.eeid || "http" }));
    }

    if (!formats.length) {
      if (geoError) throw new Error(`PBS video is geo-restricted to the US: ${geoError}`);
      throw new Error(`PBS video ${videoId} has no playable formats`);
    }

    const program = info.program?.title;
    const title = info.title
      ? program
        ? `${program} - ${info.title}`
        : info.title
      : videoId;

    return baseInfo("pbs", url, {
      id: videoId,
      display_id: displayId,
      title,
      description: info.description || description,
      duration: info.duration ?? null,
      thumbnail: info.image_url,
      formats,
    });
  }
}
