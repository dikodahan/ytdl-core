import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  hlsFormat,
  matchId,
  progressiveFormat,
} from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?:(?:beta|www)\.)?ardmediathek\.de\/(?:[^/]+\/)?(?:player|live|video)\/(?:[^?#]+\/)?(?<id>[a-zA-Z0-9]+)\/?(?:[?#]|$)/i;

interface ArdMedia {
  url?: string;
  forcedLabel?: string;
  maxHResolutionPx?: number;
  maxVResolutionPx?: number;
  videoCodec?: string;
  audios?: Array<{ kind?: string; languageCode?: string }>;
}

interface ArdStream {
  kind?: string;
  media?: ArdMedia[];
}

interface ArdPage {
  title?: string;
  fskRating?: string;
  tracking?: { atiCustomVars?: { contentId?: number } };
  widgets?: Array<{
    type?: string;
    blockedByFsk?: boolean;
    mediaCollection?: {
      embedded?: {
        streams?: ArdStream[];
        meta?: {
          title?: string;
          synopsis?: string;
          durationSeconds?: number;
          clipSourceName?: string;
          images?: Array<{ url?: string }>;
          broadcastedOnDateTime?: string;
        };
      };
    };
  }>;
}

export class ArdIE extends InfoExtractor {
  static IE_NAME = "ard";
  static IE_DESC = "ARD Mediathek";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — HLS / progressive (Germany geo)`,
      validUrl: String(this._VALID_URL),
      options: [],
      notes: "Often geo-restricted to Germany.",
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const displayId = matchId(url, VALID_URL);
    const page = await this.request.json<ArdPage>(
      `https://api.ardmediathek.de/page-gateway/pages/ard/item/${displayId}`,
      { query: { embedded: "false", mcV6: "true" } },
    );

    const player = (page.widgets || []).find(
      w => w.type === "player_ondemand" || w.type === "player_live",
    );
    if (!player) throw new Error(`ARD Mediathek player data missing for ${displayId}`);
    if (player.blockedByFsk) {
      throw new Error(
        "ARD video is age-restricted (FSK); available for age-verified users or after 22:00",
      );
    }

    const media = player.mediaCollection?.embedded;
    const formats: Format[] = [];
    for (const stream of media?.streams || []) {
      const kind = stream.kind || "main";
      for (const m of stream.media || []) {
        if (!m.url) continue;
        if (/\.m3u8(\?|$)/i.test(m.url)) {
          formats.push(hlsFormat(m.url, `hls-${kind}`));
        } else if (/^https?:/i.test(m.url)) {
          formats.push(
            progressiveFormat(m.url, {
              format_id: `http-${kind}`,
              width: m.maxHResolutionPx ?? null,
              height: m.maxVResolutionPx ?? null,
              vcodec: m.videoCodec || "unknown",
            }),
          );
        }
      }
    }

    if (!formats.length) {
      throw new Error(
        `ARD Mediathek ${displayId} has no playable formats (possibly geo-restricted to DE)`,
      );
    }

    const meta = media?.meta || {};
    const contentId = page.tracking?.atiCustomVars?.contentId;
    const videoId = contentId != null ? String(contentId) : displayId;

    return baseInfo("ard", url, {
      id: videoId,
      display_id: displayId,
      title: meta.title || page.title || videoId,
      description: meta.synopsis || null,
      duration: meta.durationSeconds ?? null,
      thumbnail: meta.images?.[0]?.url,
      uploader: meta.clipSourceName || null,
      formats,
    });
  }
}
