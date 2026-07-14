import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  matchId,
  progressiveFormat,
  tryParseJson,
} from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/podcasts\.apple\.com\/(?:[^/]+\/)?podcast(?:\/[^/]+){1,2}.*?\bi=(?<id>\d+)/i;

interface EpisodeModel {
  title?: string;
  summary?: string;
  duration?: number;
  episodeNumber?: number;
  showTitle?: string;
  releaseDate?: string;
  playAction?: {
    episodeOffer?: { streamUrl?: string };
  };
}

function findEpisodeModel(data: unknown): EpisodeModel | null {
  const stack: unknown[] = [data];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;
    if (Array.isArray(cur)) {
      stack.push(...cur);
      continue;
    }
    const obj = cur as Record<string, unknown>;
    if (obj.$kind === "share" && obj.modelType === "EpisodeLockup" && obj.model) {
      return obj.model as EpisodeModel;
    }
    for (const v of Object.values(obj)) stack.push(v);
  }
  return null;
}

function stripHtml(html: string | undefined): string | null {
  if (!html) return null;
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null;
}

export class ApplePodcastsIE extends InfoExtractor {
  static IE_NAME = "applepodcasts";
  static IE_DESC = "Apple Podcasts episodes";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — progressive audio`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const episodeId = matchId(url, VALID_URL);
    const webpage = await this.request.text(url);

    const scriptMatch = webpage.match(
      /<script[^>]*\bid=["']serialized-server-data["'][^>]*>([\s\S]*?)<\/script>/i,
    );
    if (!scriptMatch?.[1]) {
      throw new Error(`Could not find Apple Podcasts serialized-server-data for ${episodeId}`);
    }

    const serverRoot = tryParseJson<unknown>(scriptMatch[1]);
    const serverData = (serverRoot as { data?: Array<{ data?: unknown }> })?.data?.[0]?.data;
    if (!serverData) {
      throw new Error(`Could not parse Apple Podcasts server data for ${episodeId}`);
    }

    const model = findEpisodeModel(serverData);
    const streamUrl = model?.playAction?.episodeOffer?.streamUrl;
    if (!streamUrl) {
      throw new Error(`No streamUrl for Apple Podcasts episode ${episodeId}`);
    }

    const formats: Format[] = [
      progressiveFormat(streamUrl, {
        format_id: "http",
        has_video: false,
        vcodec: "none",
      }),
    ];

    const ogThumb =
      webpage.match(/property="og:image"[^>]+content="([^"]+)"/i)?.[1] ||
      webpage.match(/content="([^"]+)"[^>]+property="og:image"/i)?.[1];

    return baseInfo("applepodcasts", url, {
      id: episodeId,
      title: model?.title || episodeId,
      description: stripHtml(model?.summary),
      duration: model?.duration ?? null,
      thumbnail: ogThumb,
      formats,
    });
  }
}
