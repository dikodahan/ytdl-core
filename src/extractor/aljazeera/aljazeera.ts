import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { CategoryListResult } from "../../core/category-list";
import type { ListVideosOptions, VideoListResult } from "../../core/video-list";
import type { InfoDict } from "../../core/types";
import { BrightcoveIE } from "../brightcove";
import { YoutubeIE } from "../youtube/video";
import {
  AJ_CHANNELS_URL,
  AJ_NETWORK_ORIGIN,
  ajChannelPageUrl,
  brightcoveUrlFromVideo,
  discoverAjChannels,
  fetchAjArticleVideo,
  findBrightcovePlayerUrl,
  findYoutubeVideoId,
  normalizeAjChannelId,
  resolveAjLiveUrl,
  type AjChannelInfo,
} from "./client";

/** Network channel about pages: `/en/channels/{id}`. */
const CHANNEL_PAGE_URL =
  /^https?:\/\/(?:www\.)?network\.aljazeera\.net\/(?:en|ar)\/channels\/(?<id>[^/?#]+)\/?(?:[?#]|$)/i;

/** Live / watch pages for AJ broadcast brands. */
const LIVE_PAGE_URL =
  /^https?:\/\/(?:www\.)?(?:aljazeera\.com\/(?:live|video\/live|watch)|aljazeera\.net\/(?:live|video\/live)|(?:mubasher|doc)\.aljazeera\.net\/?|aljazeeramubasher\.net\/?)(?:[?#]|$)/i;

/** Article / program video pages (yt-dlp AlJazeeraIE shape). */
const ARTICLE_URL =
  /^https?:\/\/(?<base>[\w-]+\.aljazeera\.\w+)\/(?<type>programs?\/[^/]+|(?:feature|video|new)s)?\/\d{4}\/\d{1,2}\/\d{1,2}\/(?<id>[^/?&#]+)\/?(?:[?#]|$)/i;

/** Pseudo: `aljazeera:channels`, `aljazeera:english`, `aljazeera:aljazeera-english`. */
const PSEUDO_URL =
  /^aljazeera:(?<id>channels|[a-z0-9-]+)(?:[?#]|$)/i;

const LIST_URL_PATTERNS = [
  /^https?:\/\/(?:www\.)?network\.aljazeera\.net\/(?:en|ar)\/channels\/?(?:[?#]|$)/i,
  /^aljazeera:channels$/i,
];

function isListOnlyPseudo(url: string): boolean {
  return /^aljazeera:channels$/i.test(url);
}

export class AlJazeeraIE extends InfoExtractor {
  static IE_NAME = "aljazeera";
  static IE_DESC = "Al Jazeera live channels + Brightcove articles";
  static readonly _VALID_URL =
    /^(?:aljazeera:(?!channels$)[a-z0-9-]+|https?:\/\/(?:(?:www\.)?network\.aljazeera\.net\/(?:en|ar)\/channels\/[^/?#]+|(?:www\.)?(?:aljazeera\.com\/(?:live|video\/live|watch)|aljazeera\.net\/(?:live|video\/live)|(?:mubasher|doc)\.aljazeera\.net\/?|aljazeeramubasher\.net\/?)|(?:[\w-]+\.aljazeera\.\w+)\/(?:programs?\/[^/]+|(?:feature|video|new)s)?\/\d{4}\/\d{1,2}\/\d{1,2}\/[^/?&#]+))(?:[?#]|$)/i;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — HLS via Brightcove / YouTube live`,
      validUrl: String(this._VALID_URL),
      options: [],
      status: "ready",
      notes:
        "Discover channel IDs at `https://network.aljazeera.net/en/channels`, then extract `aljazeera:english` / channel page / live URL. Articles resolve through Brightcove.",
      listSupported: true,
    };
  }

  static suitable(url: string): boolean {
    if (LIST_URL_PATTERNS.some(re => re.test(url))) return false;
    if (isListOnlyPseudo(url)) return false;
    return (
      CHANNEL_PAGE_URL.test(url) ||
      LIVE_PAGE_URL.test(url) ||
      ARTICLE_URL.test(url) ||
      (!!url.match(PSEUDO_URL)?.groups?.id && !isListOnlyPseudo(url))
    );
  }

  static listUrlSupported(url: string): boolean {
    return LIST_URL_PATTERNS.some(re => re.test(url));
  }

  async extract(url: string): Promise<InfoDict> {
    const article = url.match(ARTICLE_URL);
    if (article?.groups) {
      return this.extractArticle(url, article.groups.id, article.groups.type);
    }

    const channelId = this.channelIdFromUrl(url);
    if (channelId) {
      const liveUrl = resolveAjLiveUrl(channelId);
      if (!liveUrl) {
        throw new Error(
          `aljazeera: channel "${channelId}" has no known live stream (centres/institute are not livestreamed)`,
        );
      }
      const info = await this.extractLivePage(liveUrl);
      info.display_id = channelId;
      info.webpage_url = ajChannelPageUrl(channelId);
      if (!info.title || info.title === info.id) {
        info.title = this.titleForChannelId(channelId);
      }
      return info;
    }

    if (LIVE_PAGE_URL.test(url)) {
      return this.extractLivePage(url);
    }

    throw new Error(`aljazeera: unsupported URL ${url}`);
  }

  async listVideos(url: string, options: ListVideosOptions = {}): Promise<VideoListResult> {
    if (!AlJazeeraIE.listUrlSupported(url)) {
      throw new Error("aljazeera: not a listing URL (use https://network.aljazeera.net/en/channels)");
    }

    let channels = await discoverAjChannels(this.request);
    if (options.limit && options.limit > 0) channels = channels.slice(0, options.limit);

    return {
      extractor: AlJazeeraIE.IE_NAME,
      webpage_url: AJ_CHANNELS_URL,
      playlist_id: "channels",
      playlist_title: "Al Jazeera channels",
      page: 1,
      entries: channels.map(ch => this.entryFromChannel(ch)),
      next_page_url: null,
    };
  }

  async listCategories(
    _url = AJ_CHANNELS_URL,
    options: { limit?: number } = {},
  ): Promise<CategoryListResult> {
    let channels = await discoverAjChannels(this.request);
    if (options.limit && options.limit > 0) channels = channels.slice(0, options.limit);
    return {
      extractor: AlJazeeraIE.IE_NAME,
      webpage_url: AJ_CHANNELS_URL,
      entries: channels.map(ch => ({
        id: ch.id,
        title: ch.title,
        url: ch.pageUrl,
        display_id: ch.id,
        thumbnail: ch.thumbnail,
      })),
    };
  }

  private channelIdFromUrl(url: string): string | null {
    const page = url.match(CHANNEL_PAGE_URL);
    if (page?.groups?.id) return normalizeAjChannelId(decodeURIComponent(page.groups.id));

    const pseudo = url.match(PSEUDO_URL);
    if (pseudo?.groups?.id && !isListOnlyPseudo(url)) {
      return normalizeAjChannelId(pseudo.groups.id);
    }
    return null;
  }

  private entryFromChannel(ch: AjChannelInfo) {
    return {
      id: ch.id,
      url: ch.liveUrl ? `aljazeera:${ch.id}` : ch.pageUrl,
      title: ch.title,
      display_id: ch.id,
      thumbnail: ch.thumbnail,
    };
  }

  private titleForChannelId(channelId: string): string {
    const titles: Record<string, string> = {
      aljazeera: "Al Jazeera Arabic",
      "aljazeera-english": "Al Jazeera English",
      "aljazeera-mubasher": "Al Jazeera Mubasher",
      "aljazeera-documentary": "Al Jazeera Documentary",
    };
    return titles[channelId] || channelId;
  }

  private async extractLivePage(liveUrl: string): Promise<InfoDict> {
    const html = await this.request.text(liveUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        Referer: `${AJ_NETWORK_ORIGIN}/`,
      },
    });

    const bc = findBrightcovePlayerUrl(html);
    if (bc) {
      const info = await this.extractBrightcove(bc, liveUrl);
      info.live_status = "is_live";
      return info;
    }

    const ytId = findYoutubeVideoId(html);
    if (ytId) {
      const info = await this.extractYoutube(ytId, liveUrl);
      info.live_status = "is_live";
      return info;
    }

    throw new Error(`aljazeera: no Brightcove/YouTube player found on ${liveUrl}`);
  }

  private async extractArticle(
    pageUrl: string,
    displayId: string,
    pathType: string | undefined,
  ): Promise<InfoDict> {
    const { title, video, webpage } = await fetchAjArticleVideo(
      this.request,
      pageUrl,
      displayId,
      pathType,
    );

    let playerUrl: string | null = null;
    if (video?.id) {
      playerUrl = brightcoveUrlFromVideo(video);
    } else if (webpage) {
      playerUrl = findBrightcovePlayerUrl(webpage);
    }

    if (!playerUrl) {
      throw new Error(`aljazeera: no Brightcove video on article ${displayId}`);
    }

    const info = await this.extractBrightcove(playerUrl, pageUrl);
    info.display_id = displayId;
    if (title) info.title = title;
    return info;
  }

  private async extractBrightcove(playerUrl: string, pageUrl: string): Promise<InfoDict> {
    const ie = new BrightcoveIE(this.params, this.request);
    const info = await ie.extract(playerUrl);
    info.extractor = AlJazeeraIE.IE_NAME;
    info.extractor_key = AlJazeeraIE.IE_NAME;
    info.webpage_url = pageUrl;
    return info;
  }

  private async extractYoutube(videoId: string, pageUrl: string): Promise<InfoDict> {
    const ie = new YoutubeIE(this.params, this.request);
    const info = await ie.extract(`https://www.youtube.com/watch?v=${videoId}`);
    info.extractor = AlJazeeraIE.IE_NAME;
    info.extractor_key = AlJazeeraIE.IE_NAME;
    info.webpage_url = pageUrl;
    info.display_id = videoId;
    return info;
  }
}
