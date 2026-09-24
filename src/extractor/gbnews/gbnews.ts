import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { CategoryListResult } from "../../core/category-list";
import type { ListVideosOptions, VideoListResult } from "../../core/video-list";
import type { Format, InfoDict } from "../../core/types";
import { baseInfo, hlsFormat } from "../_shared/helpers";
import {
  GBNEWS_CHANNELS_URL,
  GBNEWS_ORIGIN,
  PERCEPTION_ORIGIN,
  discoverGbnewsChannels,
  extractGbnewsLiveFromPage,
  fetchPerceptionStreamUrl,
  resolveGbnewsChannel,
  withHlsClientParams,
  type GbnewsChannel,
} from "./client";

/** Watch live pages: `/watch/live` and `/watch/live-2`. */
const LIVE_PAGE_URL =
  /^https?:\/\/(?:www\.)?gbnews\.com\/watch\/live(?:-2)?\/?(?:[?#]|$)/i;

/** Direct Perception.tv HLS (session `mwk` URLs). */
const PERCEPTION_HLS_URL =
  /^https?:\/\/(?:[\w-]+\.)?perception\.tv\/[^?\s]+\.m3u8(?:\?[^\s]*)?$/i;

/** Pseudo: `gbnews:gbn1`, `gbnews:385`, `gbnews:channels`. */
const PSEUDO_URL = /^gbnews:(?<id>channels|[a-z0-9-]+)(?:[?#]|$)/i;

const LIST_URL_PATTERNS = [
  LIVE_PAGE_URL,
  /^https?:\/\/(?:www\.)?gbnews\.com\/watch\/?(?:[?#]|$)/i,
  /^gbnews:channels$/i,
];

function isListOnlyPseudo(url: string): boolean {
  return /^gbnews:channels$/i.test(url);
}

export class GbnewsIE extends InfoExtractor {
  static IE_NAME = "gbnews";
  static IE_DESC = "GB News live (Perception.tv HLS)";
  static readonly _VALID_URL =
    /^(?:gbnews:(?!channels$)[a-z0-9-]+|https?:\/\/(?:www\.)?gbnews\.com\/watch\/live(?:-2)?\/?(?:[?#]|$)|https?:\/\/(?:[\w-]+\.)?perception\.tv\/[^?\s]+\.m3u8(?:\?[^\s]*)?)/i;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — signed Catherine API → mwk HLS`,
      validUrl: String(this._VALID_URL),
      options: [],
      status: "ready",
      notes:
        "Discover channels at `https://www.gbnews.com/watch/live`, then extract `gbnews:gbn1` / `gbnews:385`. Stream URLs are Perception.tv HLS with a short-lived `mwk` token.",
      listSupported: true,
    };
  }

  static suitable(url: string): boolean {
    if (LIST_URL_PATTERNS.some(re => re.test(url) && !LIVE_PAGE_URL.test(url))) return false;
    if (isListOnlyPseudo(url)) return false;
    return (
      LIVE_PAGE_URL.test(url) ||
      PERCEPTION_HLS_URL.test(url) ||
      (!!url.match(PSEUDO_URL)?.groups?.id && !isListOnlyPseudo(url))
    );
  }

  static listUrlSupported(url: string): boolean {
    if (PERCEPTION_HLS_URL.test(url)) return false;
    if (PSEUDO_URL.test(url) && !isListOnlyPseudo(url)) return false;
    return LIST_URL_PATTERNS.some(re => re.test(url));
  }

  async extract(url: string): Promise<InfoDict> {
    if (PERCEPTION_HLS_URL.test(url)) {
      return this.infoFromHls(withHlsClientParams(url), url, "GB News Live", null);
    }

    if (LIVE_PAGE_URL.test(url)) {
      const live = await extractGbnewsLiveFromPage(this.request, url);
      return this.infoFromHls(
        live.streamUrl,
        live.pageUrl,
        live.title,
        live.thumbnail,
        live.channelId,
      );
    }

    const pseudo = url.match(PSEUDO_URL);
    if (pseudo?.groups?.id) {
      const channel = await resolveGbnewsChannel(this.request, pseudo.groups.id);
      const streamUrl = await fetchPerceptionStreamUrl(this.request, channel.id);
      return this.infoFromHls(
        streamUrl,
        channel.pageUrl,
        channel.title,
        channel.thumbnail,
        channel.id,
        channel.slug,
      );
    }

    throw new Error(`gbnews: unsupported URL ${url}`);
  }

  async listVideos(url: string, options: ListVideosOptions = {}): Promise<VideoListResult> {
    if (!GbnewsIE.listUrlSupported(url)) {
      throw new Error("gbnews: not a listing URL (use https://www.gbnews.com/watch/live)");
    }

    let channels = await discoverGbnewsChannels(this.request);
    if (options.limit && options.limit > 0) channels = channels.slice(0, options.limit);

    return {
      extractor: GbnewsIE.IE_NAME,
      webpage_url: GBNEWS_CHANNELS_URL,
      playlist_id: "channels",
      playlist_title: "GB News live channels",
      page: 1,
      entries: channels.map(ch => this.entryFromChannel(ch)),
      next_page_url: null,
    };
  }

  async listCategories(
    _url = GBNEWS_CHANNELS_URL,
    options: { limit?: number } = {},
  ): Promise<CategoryListResult> {
    let channels = await discoverGbnewsChannels(this.request);
    if (options.limit && options.limit > 0) channels = channels.slice(0, options.limit);
    return {
      extractor: GbnewsIE.IE_NAME,
      webpage_url: GBNEWS_CHANNELS_URL,
      entries: channels.map(ch => ({
        id: ch.id,
        title: ch.title,
        url: ch.pageUrl,
        display_id: ch.slug,
        thumbnail: ch.thumbnail,
      })),
    };
  }

  private entryFromChannel(ch: GbnewsChannel) {
    return {
      id: ch.id,
      url: `gbnews:${ch.slug}`,
      title: ch.title,
      display_id: ch.slug,
      thumbnail: ch.thumbnail,
    };
  }

  private infoFromHls(
    streamUrl: string,
    pageUrl: string,
    title: string,
    thumbnail: string | null,
    channelId?: string,
    slug?: string,
  ): InfoDict {
    const format: Format = hlsFormat(streamUrl, "hls");
    format.http_headers = {
      Referer: `${GBNEWS_ORIGIN}/`,
      Origin: GBNEWS_ORIGIN,
    };
    format.manifest_url = streamUrl;

    return baseInfo(GbnewsIE.IE_NAME, pageUrl, {
      id: channelId || slug || "live",
      display_id: slug || channelId || "live",
      title,
      thumbnail,
      live_status: "is_live",
      age_limit: 0,
      formats: [format],
    });
  }
}

export { normalizeGbnewsChannelId } from "./client";
export { GBNEWS_LIVE_URL, PERCEPTION_ORIGIN } from "./client";
