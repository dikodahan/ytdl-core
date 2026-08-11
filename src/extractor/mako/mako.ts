import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { CategoryListResult } from "../../core/category-list";
import type { ListVideosOptions, VideoListResult } from "../../core/video-list";
import type { Format, InfoDict } from "../../core/types";
import { baseInfo, hlsFormat } from "../_shared/helpers";
import {
  findMakoChannel,
  listMakoChannels,
  makoChannelPageUrl,
  makoListingUrl,
  type MakoChannel,
} from "./channels";
import { findInMakoCatalog, getMakoCatalog } from "./discover";
import { buildAuthorizedMakoUrl, fetchMakoTicket, MAKO_REQUEST_HEADERS } from "./token";

/** Pseudo-URL: `mako:k12`, `mako:channels`, `mako:channels:free`. */
const PSEUDO_URL =
  /^mako:(?:(?<kind>channels)(?::(?<group>live|free|extra))?|(?<id>[a-z0-9-]+))$/i;

/** Direct CDN playlist on mako-streaming.akamaized.net. */
const CDN_URL =
  /^https?:\/\/mako-streaming\.akamaized\.net\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?$/i;

export class MakoIE extends InfoExtractor {
  static IE_NAME = "mako";
  static IE_DESC = "Mako / Keshet — live & free linear TV (Akamai token)";
  static readonly _VALID_URL =
    /^(?:mako:[a-z0-9:-]+|https?:\/\/mako-streaming\.akamaized\.net\/.+\.m3u8(?:\?.*)?)$/i;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — mass.mako.co.il entitlement + HLS`,
      validUrl: String(this._VALID_URL),
      options: [],
      notes:
        "Use `mako:channels` to list IDs (discovered from mako.co.il, MediaBox fallback), or `mako:k12` / a `mako-streaming.akamaized.net` m3u8 URL to extract. Streams require a short-lived Akamai `hdnea` ticket.",
      listSupported: true,
    };
  }

  static suitable(url: string): boolean {
    if (CDN_URL.test(url)) return true;
    const m = url.match(PSEUDO_URL);
    if (!m?.groups) return false;
    if (m.groups.kind === "channels") return false; // listing only
    // Accept any channel slug — catalog is discovered at extract time.
    return !!(m.groups.id);
  }

  static listUrlSupported(url: string): boolean {
    const m = url.match(PSEUDO_URL);
    return m?.groups?.kind === "channels";
  }

  async extract(url: string): Promise<InfoDict> {
    const resolved = await this.resolveTarget(url);
    const tokenLp = resolved.tokenUrl || resolved.streamUrl;
    const ticket = await fetchMakoTicket(this.request, tokenLp);
    const playUrl = buildAuthorizedMakoUrl(resolved.streamUrl, ticket);

    const format: Format = hlsFormat(playUrl, "hls");
    format.http_headers = { ...MAKO_REQUEST_HEADERS };
    format.manifest_url = playUrl;

    return baseInfo(MakoIE.IE_NAME, resolved.pageUrl, {
      id: resolved.id,
      display_id: resolved.id,
      title: resolved.name,
      thumbnail: resolved.thumbnail || null,
      live_status: "is_live",
      age_limit: 0,
      formats: [format],
    });
  }

  async listVideos(url: string, options: ListVideosOptions = {}): Promise<VideoListResult> {
    const m = url.match(PSEUDO_URL);
    if (m?.groups?.kind !== "channels") {
      throw new Error("mako: not a listing URL (use mako:channels or mako:channels:live|free|extra)");
    }

    const group = m.groups.group as MakoChannel["group"] | undefined;
    const { channels: discovered, source } = await getMakoCatalog(this.request, { group });
    let channels = discovered;
    if (options.limit && options.limit > 0) channels = channels.slice(0, options.limit);

    return {
      extractor: MakoIE.IE_NAME,
      webpage_url: makoListingUrl(group),
      playlist_id: group || "all",
      playlist_title: group
        ? `Mako ${group}`
        : source === "site+fallback"
          ? "Mako channels (site + fallback)"
          : "Mako channels (fallback)",
      page: 1,
      entries: channels.map(ch => ({
        id: ch.id,
        url: makoChannelPageUrl(ch.id),
        title: ch.name,
        display_id: ch.id,
        thumbnail: ch.thumbnail || null,
      })),
      next_page_url: null,
    };
  }

  async listCategories(
    _url = "mako:channels",
    options: { limit?: number } = {},
  ): Promise<CategoryListResult> {
    let entries = [
      { id: "all", title: "All channels", url: makoListingUrl() },
      { id: "live", title: "Live (Keshet 12 / 24)", url: makoListingUrl("live") },
      { id: "free", title: "Free linear", url: makoListingUrl("free") },
      { id: "extra", title: "Extra / shows", url: makoListingUrl("extra") },
    ];
    if (options.limit && options.limit > 0) entries = entries.slice(0, options.limit);
    return {
      extractor: MakoIE.IE_NAME,
      webpage_url: makoListingUrl(),
      entries,
    };
  }

  private async resolveTarget(url: string): Promise<{
    id: string;
    name: string;
    streamUrl: string;
    tokenUrl?: string;
    thumbnail?: string;
    pageUrl: string;
  }> {
    if (CDN_URL.test(url)) {
      const u = new URL(url);
      // Strip prior hdnea tickets so we mint a fresh one.
      u.searchParams.delete("hdnea");
      ["st", "exp", "acl", "hmac"].forEach(k => u.searchParams.delete(k));
      const clean = u.toString().replace(/\?$/, "");
      const { channels } = await getMakoCatalog(this.request);
      const known = channels.find(
        c =>
          c.streamUrl === clean ||
          c.tokenUrl === clean ||
          c.streamUrl.split("?")[0] === clean.split("?")[0],
      );
      return {
        id: known?.id || slugFromCdnPath(u.pathname),
        name: known?.name || slugFromCdnPath(u.pathname),
        streamUrl: known?.streamUrl || clean,
        tokenUrl: known?.tokenUrl,
        thumbnail: known?.thumbnail,
        pageUrl: known ? makoChannelPageUrl(known.id) : clean,
      };
    }

    const m = url.match(PSEUDO_URL);
    const id = m?.groups?.id;
    if (!id) throw new Error(`mako: invalid URL ${url}`);

    const { channels } = await getMakoCatalog(this.request);
    const channel =
      findInMakoCatalog(channels, id) || findMakoChannel(id) || listMakoChannels().find(c => c.id === id);
    if (!channel) throw new Error(`mako: unknown channel id "${id}" (try mako:channels)`);
    return {
      id: channel.id,
      name: channel.name,
      streamUrl: channel.streamUrl,
      tokenUrl: channel.tokenUrl,
      thumbnail: channel.thumbnail,
      pageUrl: makoChannelPageUrl(channel.id),
    };
  }
}

function slugFromCdnPath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.findIndex(p => p === "live");
  if (idx >= 0 && parts[idx + 2]) return parts[idx + 2].replace(/\.m3u8$/i, "");
  return parts[parts.length - 2] || "mako";
}
