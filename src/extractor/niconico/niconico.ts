import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import { baseInfo, hlsFormat, matchId } from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?:(?:embed|sp|www)\.)?nicovideo\.jp\/(?:shorts|watch)\/(?<id>(?:[a-z]{2})?\d+)/i;

const API_BASE = "https://nvapi.nicovideo.jp";
const BASE_URL = "https://www.nicovideo.jp";
const HEADERS = {
  "X-Frontend-ID": "6",
  "X-Frontend-Version": "0",
};

interface DomandTrack {
  id?: string;
  isAvailable?: boolean;
  bitRate?: number;
  qualityLevel?: number;
}

interface NiconicoWatchData {
  media?: {
    domand?: {
      videos?: DomandTrack[];
      audios?: DomandTrack[];
      accessRightKey?: string;
    };
  };
  client?: { watchTrackId?: string };
  video?: {
    id?: string;
    title?: string;
    description?: string;
    duration?: number;
    thumbnail?: Record<string, string>;
  };
  channel?: { name?: string; nickname?: string; id?: string | number };
  owner?: { name?: string; nickname?: string; id?: string | number };
  reasonCode?: string;
  payment?: {
    video?: {
      isContinuationBenefit?: boolean;
      isPpv?: boolean;
      isAdmission?: boolean;
      isPremium?: boolean;
    };
  };
  publishScheduledAt?: string;
  viewer?: { allowSensitiveContents?: boolean };
}

interface NiconicoApiResp {
  meta?: { status?: number; errorCode?: string };
  data?: NiconicoWatchData;
}

const ERROR_MAP: Record<string, Record<string, string>> = {
  FORBIDDEN: {
    ADMINISTRATOR_DELETE_VIDEO: "Video unavailable, possibly removed by admins",
    CHANNEL_MEMBER_ONLY: "Channel members only",
    DELETED_CHANNEL_VIDEO: "Video unavailable, channel was closed",
    DELETED_COMMUNITY_VIDEO: "Video unavailable, community deleted or missing",
    DEFAULT: "Page unavailable, check the URL",
    HARMFUL_VIDEO: "Sensitive content, login required",
    HIDDEN_VIDEO: "Video unavailable, set to private",
    NOT_ALLOWED: "No permission",
    PPV_VIDEO: "PPV video, payment information required",
    PREMIUM_ONLY: "Premium members only",
  },
  INVALID_PARAMETER: {
    DEFAULT: "Video unavailable, may not exist or was deleted",
  },
  MAINTENANCE: { DEFAULT: "Maintenance is in progress" },
  NOT_FOUND: {
    DEFAULT: "Video unavailable, may not exist or was deleted",
    RIGHT_HOLDER_DELETE_VIDEO: "Removed by rights-holder request",
  },
  UNAUTHORIZED: { DEFAULT: "Invalid session, re-login required" },
  UNKNOWN: { DEFAULT: "Failed to fetch content" },
};

export class NiconicoIE extends InfoExtractor {
  static IE_NAME = "niconico";
  static IE_DESC = "ニコニコ動画 / niconico";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — guest API + HLS access-rights`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const videoId = matchId(url, VALID_URL);
    const trackId = `AAAAAAAAAA_${Date.now()}`;

    const apiResp = await this.request.json<NiconicoApiResp>(
      `${BASE_URL}/api/watch/v3_guest/${videoId}`,
      {
        headers: { ...HEADERS },
        query: { actionTrackId: trackId },
      },
    ).catch(async (err: Error & { statusCode?: number; body?: string }) => {
      if (err.statusCode && err.body) {
        try {
          return JSON.parse(err.body) as NiconicoApiResp;
        } catch {
          /* fall through */
        }
      }
      throw err;
    });

    const status = apiResp.meta?.status ?? 0;
    const apiData = apiResp.data;

    if (status !== 200 || !apiData) {
      const errCode = (apiResp.meta?.errorCode || "UNKNOWN").toUpperCase();
      const reason = apiData?.reasonCode || "DEFAULT";
      let errMsg =
        ERROR_MAP[errCode]?.[reason] || ERROR_MAP[errCode]?.DEFAULT || `API returned error status ${status}`;

      if (reason === "DOMESTIC_VIDEO" || reason === "HIGH_RISK_COUNTRY_VIDEO") {
        throw new Error("niconico: geo-restricted to Japan");
      }
      if (
        reason === "HARMFUL_VIDEO" &&
        apiData?.viewer?.allowSensitiveContents === false
      ) {
        errMsg = "Sensitive content, adjust display settings to watch";
      }
      if (reason === "HIDDEN_VIDEO" && apiData?.publishScheduledAt) {
        errMsg = `This content is scheduled to be released at ${apiData.publishScheduledAt}`;
      }
      if (
        ["CHANNEL_MEMBER_ONLY", "HARMFUL_VIDEO", "HIDDEN_VIDEO", "PPV_VIDEO", "PREMIUM_ONLY"].includes(
          reason,
        )
      ) {
        throw new Error(`niconico: login required — ${errMsg}`);
      }
      throw new Error(`niconico: ${errMsg}`);
    }

    const formats = await this.extractFormats(apiData, videoId);
    if (!formats.length) {
      const pay = apiData.payment?.video;
      if (pay?.isPremium) throw new Error("niconico: Premium members only (login required)");
      if (pay?.isAdmission) throw new Error("niconico: Channel members only (login required)");
      if (pay?.isPpv || pay?.isContinuationBenefit) {
        throw new Error("niconico: PPV video, payment information required");
      }
      throw new Error(`niconico: no playable HLS formats for ${videoId}`);
    }

    const owner = apiData.channel || apiData.owner;
    const thumbs = apiData.video?.thumbnail || {};
    const thumbnail =
      thumbs.player || thumbs.ogp || thumbs.largeUrl || thumbs.middleUrl || thumbs.url;

    return baseInfo("niconico", url, {
      id: apiData.video?.id || videoId,
      title: apiData.video?.title || videoId,
      description: apiData.video?.description || null,
      duration: apiData.video?.duration ?? null,
      uploader: owner?.name || owner?.nickname || null,
      uploader_id: owner?.id != null ? String(owner.id) : null,
      thumbnail,
      formats,
      http_headers: { Referer: `${BASE_URL}/` },
    });
  }

  private async extractFormats(apiData: NiconicoWatchData, videoId: string): Promise<Format[]> {
    const videos = (apiData.media?.domand?.videos || []).filter(v => v.isAvailable && v.id);
    const audios = (apiData.media?.domand?.audios || []).filter(a => a.isAvailable && a.id);
    const accessKey = apiData.media?.domand?.accessRightKey;
    const trackId = apiData.client?.watchTrackId;
    if (!videos.length || !audios.length || !accessKey || !trackId) return [];

    const outputs: [string, string][] = [];
    for (const v of videos) {
      for (const a of audios) {
        if (v.id && a.id) outputs.push([v.id, a.id]);
      }
    }

    const hlsResp = await this.request.json<{ data?: { contentUrl?: string } }>(
      `${API_BASE}/v1/watch/${videoId}/access-rights/hls`,
      {
        method: "POST",
        query: { actionTrackId: trackId },
        headers: {
          Accept: "application/json;charset=utf-8",
          "Content-Type": "application/json",
          "X-Access-Right-Key": accessKey,
          "X-Request-With": BASE_URL,
          ...HEADERS,
        },
        body: JSON.stringify({ outputs }),
      },
    );

    const contentUrl = hlsResp.data?.contentUrl;
    if (!contentUrl) return [];

    // Best-effort: one master HLS covering the video×audio quality product
    return [hlsFormat(contentUrl, "hls")];
  }
}
