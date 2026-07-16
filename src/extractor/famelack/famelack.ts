import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import type { CategoryListResult } from "../../core/category-list";
import type { ListVideosOptions, VideoListResult } from "../../core/video-list";
import {
  buildCountryCategories,
  buildTvCategoryIndex,
  channelPageUrl,
  channelsToListEntries,
  fetchScopeChannels,
  findChannel,
  isCountryScope,
  listingPageUrl,
  normalizeChannel,
  youtubeWatchUrls,
} from "./famelack-data";
import { baseInfo, hlsFormat, progressiveFormat } from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?:www\.)?famelack\.com\/tv(?:\/(?<scope>[a-z]{2}|[a-z0-9+-]+))?(?:\/(?<id>[A-Za-z0-9]+))?\/?(?:[?#]|$)/i;

const LIST_URL_PATTERNS = [
  /^https?:\/\/(?:www\.)?famelack\.com\/tv(?:\/(?<scope>[a-z]{2}|[a-z0-9+-]+))?\/?(?:[?#]|$)/i,
];

function streamFormats(channel: ReturnType<typeof normalizeChannel>): Format[] {
  const formats: Format[] = [];
  const seen = new Set<string>();

  for (const [index, url] of channel.streamUrls.entries()) {
    if (seen.has(url)) continue;
    seen.add(url);
    const formatId = channel.streamUrls.length > 1 ? `hls-${index + 1}` : "hls";
    if (/\.m3u8($|\?)/i.test(url) || /\.smil\/playlist\.m3u8/i.test(url)) {
      formats.push(hlsFormat(url, formatId));
    } else {
      formats.push(progressiveFormat(url, { format_id: formatId }));
    }
  }

  for (const [index, url] of youtubeWatchUrls(channel).entries()) {
    if (seen.has(url)) continue;
    seen.add(url);
    formats.push(
      progressiveFormat(url, {
        format_id: channel.streamUrls.length ? `youtube-${index + 1}` : "youtube",
        ext: "mp4",
        vcodec: "unknown",
        acodec: "unknown",
      }),
    );
  }

  return formats;
}

export class FamelackIE extends InfoExtractor {
  static IE_NAME = "famelack";
  static IE_DESC = "Famelack live TV channels";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — HLS / YouTube from famelack-data`,
      validUrl: String(this._VALID_URL),
      options: [],
      notes:
        "Paste a Famelack TV channel URL (`famelack.com/tv/{country|category}/{nanoid}`). Channel data comes from the public famelack-data GitHub repo.",
      listSupported: true,
    };
  }

  static listUrlSupported(url: string): boolean {
    const m = url.match(VALID_URL);
    if (!m?.groups?.scope) return false;
    if (m.groups.id) return false;
    return LIST_URL_PATTERNS.some(re => re.test(url));
  }

  private parseUrl(url: string): { scope?: string; id?: string } {
    const m = url.match(VALID_URL);
    return {
      scope: m?.groups?.scope?.toLowerCase(),
      id: m?.groups?.id,
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const { scope, id } = this.parseUrl(url);
    if (!scope || !id) {
      throw new Error(`famelack: paste a channel URL like https://famelack.com/tv/us/{nanoid}`);
    }

    const channel = await findChannel(this.request, scope, id);
    if (!channel) {
      throw new Error(`famelack: channel ${id} not found under ${scope}`);
    }

    const formats = streamFormats(channel);
    if (!formats.length) {
      throw new Error(`famelack: no playable streams for ${channel.name} (${id})`);
    }

    const pageUrl = channelPageUrl(scope, id);
    const notes: string[] = [];
    if (channel.isGeoBlocked) notes.push("Marked geo-blocked on Famelack.");
    if (!channel.streamUrls.length && channel.youtubeUrls.length) {
      notes.push("YouTube-only channel; use the youtube extractor for best playback.");
    }

    return baseInfo("famelack", pageUrl, {
      id,
      display_id: id,
      title: channel.name,
      uploader: isCountryScope(scope) ? scope.toUpperCase() : titleCaseScope(scope),
      live_status: "is_live",
      age_limit: 0,
      formats,
      ...(notes.length ? { description: notes.join(" ") } : {}),
    });
  }

  async listVideos(url: string, options: ListVideosOptions = {}): Promise<VideoListResult> {
    const { scope } = this.parseUrl(url);
    if (!scope) {
      throw new Error(`famelack: not a listing URL (use /tv/{country} or /tv/{category})`);
    }

    const channels = await fetchScopeChannels(this.request, scope);
    let entries = channelsToListEntries(channels, scope);
    if (options.limit && options.limit > 0) entries = entries.slice(0, options.limit);

    const playlistTitle = isCountryScope(scope)
      ? `${scope.toUpperCase()} TV`
      : `${titleCaseScope(scope)} TV`;

    return {
      extractor: FamelackIE.IE_NAME,
      webpage_url: listingPageUrl(scope),
      playlist_id: scope,
      playlist_title: playlistTitle,
      page: 1,
      entries,
      next_page_url: null,
    };
  }

  async listCategories(
    url = "https://famelack.com/tv",
    options: { limit?: number } = {},
  ): Promise<CategoryListResult> {
    const normalized = url.replace(/\/+$/, "") || "https://famelack.com/tv";
    let entries =
      normalized.endsWith("/tv") || normalized.includes("/tv/countries")
        ? await buildCountryCategories(this.request)
        : buildTvCategoryIndex();

    if (options.limit && options.limit > 0) {
      entries = entries.slice(0, options.limit);
    }

    return {
      extractor: FamelackIE.IE_NAME,
      webpage_url: normalized.endsWith("/tv") ? "https://famelack.com/tv" : normalized,
      entries,
    };
  }
}

function titleCaseScope(scope: string): string {
  return scope
    .split(/[-_+]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
