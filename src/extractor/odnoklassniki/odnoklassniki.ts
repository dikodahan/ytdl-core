import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  dashFormat,
  hlsFormat,
  matchId,
  progressiveFormat,
  tryParseJson,
} from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?:(?:www|m|mobile)\.)?(?:odnoklassniki|ok)\.ru\/(?:video(?:embed)?\/|web-api\/video\/moviePlayer\/|live\/|dk\?.*?st\.mvId=)(?<id>[\d-]+)/i;

function unescapeHtml(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

interface OkVideo {
  url?: string;
  name?: string;
}

interface OkMetadata {
  provider?: string;
  movie?: {
    title?: string;
    poster?: string;
    duration?: number;
    contentId?: string;
  };
  author?: { id?: string; name?: string };
  videos?: OkVideo[];
  hlsManifestUrl?: string;
  ondemandHls?: string;
  hlsMasterPlaylistUrl?: string;
  ondemandDash?: string;
  metadataWebmUrl?: string;
  paymentInfo?: unknown;
  likeCount?: number;
}

interface OkFlashvars {
  metadata?: string;
  metadataUrl?: string;
  location?: string;
}

interface OkPlayer {
  flashvars?: OkFlashvars;
  isExternalPlayer?: boolean;
  url?: string;
}

export class OdnoklassnikiIE extends InfoExtractor {
  static IE_NAME = "odnoklassniki";
  static IE_DESC = "OK.ru / Odnoklassniki";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — data-options flashvars metadata`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const videoId = matchId(url, VALID_URL);
    const webpage = await this.request.text(`https://ok.ru/video/${videoId}`);

    if (/Access to this video is restricted/i.test(webpage)) {
      throw new Error("odnoklassniki: access restricted — login required");
    }
    const stub = webpage.match(/class="[^"]*vp_video_stub_txt[^"]*"[^>]*>([^<]+)/i)?.[1]?.trim();
    if (stub) throw new Error(`odnoklassniki: ${stub}`);

    const playerMatch = webpage.match(
      new RegExp(
        `data-options=(['"])(?<player>\\{.+?${videoId}.+?\\})\\1`,
        "s",
      ),
    );
    if (!playerMatch?.groups?.player) {
      throw new Error(`odnoklassniki: data-options player not found for ${videoId}`);
    }

    const player = tryParseJson<OkPlayer>(unescapeHtml(playerMatch.groups.player));
    if (!player) throw new Error("odnoklassniki: failed to parse player JSON");

    if (player.isExternalPlayer && player.url) {
      throw new Error(
        `odnoklassniki: external player redirect not followed — open ${player.url} directly`,
      );
    }

    const flashvars = player.flashvars;
    if (!flashvars) throw new Error("odnoklassniki: missing flashvars");

    let metadata: OkMetadata | null = null;
    if (flashvars.metadata) {
      metadata = tryParseJson<OkMetadata>(
        typeof flashvars.metadata === "string"
          ? flashvars.metadata
          : JSON.stringify(flashvars.metadata),
      );
      // flashvars.metadata may already be object if double-encoded oddly
      if (!metadata && typeof flashvars.metadata === "object") {
        metadata = flashvars.metadata as unknown as OkMetadata;
      }
      // Sometimes metadata is an embedded JSON string that needs another parse after unescape
      if (!metadata) {
        metadata = tryParseJson<OkMetadata>(unescapeHtml(String(flashvars.metadata)));
      }
    }

    if (!metadata && flashvars.metadataUrl) {
      const metaUrl = decodeURIComponent(flashvars.metadataUrl);
      const body = flashvars.location
        ? new URLSearchParams({ "st.location": flashvars.location }).toString()
        : undefined;
      metadata = await this.request.json<OkMetadata>(metaUrl, {
        method: body ? "POST" : "GET",
        headers: body
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : undefined,
        body,
      });
    }

    if (!metadata) throw new Error(`odnoklassniki: no metadata for ${videoId}`);

    if (metadata.provider === "USER_YOUTUBE" && metadata.movie?.contentId) {
      throw new Error(
        `odnoklassniki: YouTube embed — use YouTube extractor with ${metadata.movie.contentId}`,
      );
    }

    const formats: Format[] = [];
    for (const f of metadata.videos || []) {
      if (!f.url) continue;
      formats.push(progressiveFormat(f.url, { format_id: f.name || "http" }));
    }

    const hlsUrl = metadata.hlsManifestUrl || metadata.ondemandHls || metadata.hlsMasterPlaylistUrl;
    if (hlsUrl) formats.push(hlsFormat(hlsUrl, "hls"));

    if (metadata.ondemandDash) formats.push(dashFormat(metadata.ondemandDash, "dash"));
    if (metadata.metadataWebmUrl) formats.push(dashFormat(metadata.metadataWebmUrl, "webm"));

    if (!formats.length) {
      if (metadata.paymentInfo) {
        throw new Error("odnoklassniki: this video is paid — subscribe to download it");
      }
      throw new Error(`odnoklassniki: no playable formats for ${videoId}`);
    }

    const movie = metadata.movie || {};
    return baseInfo("odnoklassniki", url, {
      id: videoId,
      title: movie.title || videoId,
      duration: movie.duration ?? null,
      thumbnail: movie.poster,
      uploader: metadata.author?.name || null,
      uploader_id: metadata.author?.id || null,
      formats,
      http_headers: { Referer: "https://ok.ru/" },
    });
  }
}
