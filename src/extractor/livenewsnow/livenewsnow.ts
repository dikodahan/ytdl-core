import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { CategoryListResult } from "../../core/category-list";
import type { ListVideosOptions, VideoListResult } from "../../core/video-list";
import type { Format, InfoDict } from "../../core/types";
import { baseInfo, hlsFormat } from "../_shared/helpers";
import {
  CATEGORY_PAGE_URL,
  CHANNEL_PAGE_URL,
  LNN_HOME_URL,
  LNN_STREAM_HEADERS,
  SIGNED_HLS_URL,
  discoverAllLnnChannels,
  discoverLnnCategoryChannels,
  extractLnnStreamFromPage,
  listLnnCategories,
  lnnCategoryUrl,
  parseCategoryPageUrl,
  parseChannelPageUrl,
  parseLnnPseudoId,
  resolveLnnChannel,
  type LnnCategoryId,
  type LnnChannel,
} from "./client";

/** Pseudo: `livenewsnow:foxnews`, `livenewsnow:featured/foxnews`, `livenewsnow:american`, `livenewsnow:categories`. */
const PSEUDO_URL =
  /^livenewsnow:(?<id>categories|american|business|(?:(?:american|business|featured)\/)?[a-z0-9-]+)(?:[?#]|$)/i;

const LIST_URL_PATTERNS = [
  CATEGORY_PAGE_URL,
  /^https?:\/\/(?:www\.)?livenewsnow\.com\/?(?:[?#]|$)/i,
  /^livenewsnow:(?:categories|american|business)$/i,
];

function isListOnlyPseudo(url: string): boolean {
  return /^livenewsnow:(?:categories|american|business)$/i.test(url);
}

function isChannelPseudo(url: string): boolean {
  const m = url.match(PSEUDO_URL);
  if (!m?.groups?.id || isListOnlyPseudo(url)) return false;
  const parsed = parseLnnPseudoId(m.groups.id);
  return parsed?.kind === "channel";
}

export class LiveNewsNowIE extends InfoExtractor {
  static IE_NAME = "livenewsnow";
  static IE_DESC = "Live News Now live channels (livenewsnow.com)";
  static readonly _VALID_URL =
    /^(?:livenewsnow:(?!categories$|american$|business$)(?:(?:american|business|featured)\/)?[a-z0-9-]+|https?:\/\/(?:www\.)?livenewsnow\.com\/(?:american|business|featured)\/[a-z0-9-]+(?:\.html)?\/?(?:[?#]|$)|https?:\/\/(?:[\w.-]+\.)?livenewsplay(?:er)?\.com(?::\d+)?\/[^\s]+\.m3u8(?:\?[^\s]*)?)/i;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — signed HLS (token/expires/sig)`,
      validUrl: String(this._VALID_URL),
      options: [],
      status: "ready",
      notes:
        "Extract mints a fresh signed HLS URL via `?renew=1` when available (otherwise scrapes the page embed). Discover channels with `livenewsnow:categories`. Streams include signed query params (`token`/`expires`/`sig` or `sec*`/`newz*`).",
      listSupported: true,
    };
  }

  static suitable(url: string): boolean {
    if (LIST_URL_PATTERNS.some(re => re.test(url) && !CHANNEL_PAGE_URL.test(url))) return false;
    if (isListOnlyPseudo(url)) return false;
    return (
      CHANNEL_PAGE_URL.test(url) ||
      SIGNED_HLS_URL.test(url) ||
      isChannelPseudo(url)
    );
  }

  static listUrlSupported(url: string): boolean {
    if (CHANNEL_PAGE_URL.test(url)) return false;
    if (SIGNED_HLS_URL.test(url)) return false;
    if (isChannelPseudo(url)) return false;
    return LIST_URL_PATTERNS.some(re => re.test(url));
  }

  async extract(url: string): Promise<InfoDict> {
    if (SIGNED_HLS_URL.test(url)) {
      return this.infoFromStream(url, url, "Live News Now", null, "live");
    }

    const page = parseChannelPageUrl(url);
    if (page) {
      const live = await extractLnnStreamFromPage(this.request, page.pageUrl);
      return this.infoFromStream(
        live.streamUrl,
        live.pageUrl,
        live.title,
        live.thumbnail,
        live.channelId,
        page.slug,
      );
    }

    const pseudo = url.match(PSEUDO_URL);
    if (pseudo?.groups?.id) {
      const parsed = parseLnnPseudoId(pseudo.groups.id);
      if (parsed?.kind === "channel" && parsed.slug) {
        const channel = await resolveLnnChannel(this.request, {
          section: parsed.section,
          slug: parsed.slug,
        });
        const live = await extractLnnStreamFromPage(this.request, channel.pageUrl);
        return this.infoFromStream(
          live.streamUrl,
          live.pageUrl,
          live.title || channel.title,
          live.thumbnail || channel.thumbnail,
          live.channelId,
          channel.displayId,
        );
      }
    }

    throw new Error(`livenewsnow: unsupported URL ${url}`);
  }

  async listVideos(url: string, options: ListVideosOptions = {}): Promise<VideoListResult> {
    if (!LiveNewsNowIE.listUrlSupported(url)) {
      throw new Error(
        "livenewsnow: not a listing URL (use /category/american, /category/business, or livenewsnow:categories)",
      );
    }

    const categoryId = this.resolveListCategory(url);
    let channels: LnnChannel[];
    let webpageUrl: string;
    let playlistId: string;
    let playlistTitle: string;

    if (categoryId) {
      channels = await discoverLnnCategoryChannels(this.request, categoryId);
      webpageUrl = lnnCategoryUrl(categoryId);
      playlistId = categoryId;
      playlistTitle = `Live News Now — ${categoryId}`;
    } else {
      channels = await discoverAllLnnChannels(this.request);
      webpageUrl = LNN_HOME_URL;
      playlistId = "channels";
      playlistTitle = "Live News Now channels";
    }

    if (options.limit && options.limit > 0) channels = channels.slice(0, options.limit);

    return {
      extractor: LiveNewsNowIE.IE_NAME,
      webpage_url: webpageUrl,
      playlist_id: playlistId,
      playlist_title: playlistTitle,
      page: 1,
      entries: channels.map(ch => this.entryFromChannel(ch)),
      next_page_url: null,
    };
  }

  async listCategories(
    _url = LNN_HOME_URL,
    options: { limit?: number } = {},
  ): Promise<CategoryListResult> {
    let categories = listLnnCategories();
    if (options.limit && options.limit > 0) categories = categories.slice(0, options.limit);
    return {
      extractor: LiveNewsNowIE.IE_NAME,
      webpage_url: LNN_HOME_URL,
      entries: categories.map(c => ({
        id: c.id,
        title: c.title,
        url: c.url,
        display_id: c.id,
        thumbnail: null,
      })),
    };
  }

  private resolveListCategory(url: string): LnnCategoryId | null {
    const fromPage = parseCategoryPageUrl(url);
    if (fromPage) return fromPage;
    const pseudo = url.match(PSEUDO_URL);
    if (pseudo?.groups?.id) {
      const parsed = parseLnnPseudoId(pseudo.groups.id);
      if (parsed?.kind === "category" && parsed.categoryId) return parsed.categoryId;
    }
    return null;
  }

  private entryFromChannel(ch: LnnChannel) {
    return {
      id: ch.id,
      url: `livenewsnow:${ch.displayId}`,
      title: ch.title,
      display_id: ch.displayId,
      thumbnail: ch.thumbnail,
    };
  }

  private infoFromStream(
    streamUrl: string,
    pageUrl: string,
    title: string,
    thumbnail: string | null,
    channelId: string,
    displayId?: string,
  ): InfoDict {
    const format: Format = hlsFormat(streamUrl, "hls");
    format.http_headers = { ...LNN_STREAM_HEADERS };
    format.manifest_url = streamUrl;

    return baseInfo(LiveNewsNowIE.IE_NAME, pageUrl, {
      id: channelId,
      display_id: displayId || channelId,
      title,
      thumbnail,
      live_status: "is_live",
      age_limit: 0,
      formats: [format],
    });
  }
}

export { LNN_ORIGIN, LNN_HOME_URL, extractSignedStreamUrl, unescapeJsString } from "./client";
