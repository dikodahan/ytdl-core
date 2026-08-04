import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { CategoryListResult } from "../../core/category-list";
import type { ListVideosOptions, VideoListResult } from "../../core/video-list";
import type { Format, InfoDict } from "../../core/types";
import { baseInfo, hlsFormat } from "../_shared/helpers";
import {
  DEFAULT_ONTIVI_PLAYER_CONFIG,
  parseOntiviPlayerConfig,
  resolveOntiviPlayerFile,
  type OntiviPlayerConfig,
} from "./playerjs";

const CHANNEL_URL =
  /^https?:\/\/(?<host>(?:[\w-]+\.)?ontivi\.net)\/(?<slug>(?!kontact\.html)[^/?#]+\.html)(?:[?#]|$)/i;
const LIST_URL =
  /^https?:\/\/(?<host>(?:[\w-]+\.)?ontivi\.net)\/(?:(?:tv\d*|chanel)(?:\?[^#]*)?)?(?:[?#]|$)/i;

const CHANNEL_TILE_RE =
  /<div\s+class="gltv"\s+title="([^"]+)"\s*>\s*<a\s+href="([^"]+)"/gi;
const KODK_RE = /var\s+kodk\s*=\s*"([^"]+)"/;
const KOS_RE = /var\s+kos\s*=\s*"([^"]+)"/;
const FILE_RE = /file\s*:\s*"([^"]+)"/;
const TITLE_RE = /<h1[^>]*>\s*(?:Телеканал:\s*)?([^<]+?)\s*(?:онлайн)?\s*<\/h1>/i;
const THUMB_RE = /<div\s+class="ch-img"\s*>\s*<img[^>]+src="([^"]+)"/i;
const PLAYER_SRC_RE = /<script[^>]+src="([^"]*p\d+\.js)"/i;

const DEFAULT_ORIGIN = "https://ip.ontivi.net";
const DEFAULT_LIST_PATH = "/chanel?catgl=1";

let cachedPlayerConfig: OntiviPlayerConfig | null = null;
let cachedPlayerConfigAt = 0;
const PLAYER_CONFIG_TTL_MS = 6 * 60 * 60 * 1000;

function absUrl(pathOrUrl: string, base: string): string {
  try {
    return new URL(pathOrUrl, base).toString();
  } catch {
    return pathOrUrl;
  }
}

function channelIdFromSlug(slug: string): string {
  return slug.replace(/\.html$/i, "");
}

function parseChannelTiles(html: string, origin: string): Array<{ id: string; url: string; title: string }> {
  const out: Array<{ id: string; url: string; title: string }> = [];
  const seen = new Set<string>();
  CHANNEL_TILE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CHANNEL_TILE_RE.exec(html))) {
    const title = m[1].trim();
    const href = m[2].trim();
    if (!href || href === "/" || /kontact/i.test(href)) continue;
    const url = absUrl(href, origin);
    const slug = url.split("/").pop() || href;
    if (!/\.html$/i.test(slug)) continue;
    const id = channelIdFromSlug(slug);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, url, title });
  }
  return out;
}

export class OntiviIE extends InfoExtractor {
  static IE_NAME = "ontivi";
  static IE_DESC = "Ontivi — free live TV channels (HLS)";
  static readonly _VALID_URL = CHANNEL_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — ip.ontivi.net Playerjs streams`,
      validUrl: String(this._VALID_URL),
      options: [],
      notes:
        "Paste a channel page (`https://ip.ontivi.net/{slug}.html`) or list channels from `https://ip.ontivi.net/tv3` / `https://ip.ontivi.net/chanel?catgl=1`.",
      listSupported: true,
    };
  }

  static listUrlSupported(url: string): boolean {
    if (CHANNEL_URL.test(url)) return false;
    return LIST_URL.test(url);
  }

  async extract(url: string): Promise<InfoDict> {
    const match = url.match(CHANNEL_URL);
    if (!match?.groups?.slug) {
      throw new Error("ontivi: paste a channel URL like https://ip.ontivi.net/024721-9-kanal-izrail.html");
    }

    const origin = `https://${match.groups.host || "ip.ontivi.net"}`;
    const pageUrl = absUrl(`/${match.groups.slug}`, origin);
    const html = await this.request.text(pageUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        Referer: `${origin}/`,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const kodk = html.match(KODK_RE)?.[1];
    const kos = html.match(KOS_RE)?.[1];
    const file = html.match(FILE_RE)?.[1];
    if (!kodk || !kos || !file) {
      throw new Error("ontivi: page is missing Playerjs stream variables (kodk/kos/file)");
    }

    const config = await this.loadPlayerConfig(html, origin);
    const candidates = resolveOntiviPlayerFile(file, { kodk, kos }, config);
    if (!candidates.length) {
      throw new Error("ontivi: could not decode Playerjs stream URL");
    }

    const headers = {
      Referer: `${origin}/`,
      Origin: origin,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    // Prefer s.ontivi.net; drop dead mirrors (r.pokaz.me often times out).
    // Resolve the gate URL's relative 302 into an absolute tokenized playlist —
    // many players fail on Location: /{token}/…/index.m3u8.
    const preferred = [
      ...candidates.filter(u => /s\.ontivi\.net/i.test(u)),
      ...candidates.filter(u => !/s\.ontivi\.net/i.test(u)),
    ];
    const formats: Format[] = [];
    const seen = new Set<string>();
    for (const gateUrl of preferred) {
      const resolved = await this.resolvePlayableHls(gateUrl, headers);
      if (!resolved || seen.has(resolved.url)) continue;
      seen.add(resolved.url);
      const format = hlsFormat(
        resolved.url,
        formats.length === 0 ? "hls" : `hls-${formats.length + 1}`,
      );
      format.http_headers = headers;
      format.manifest_url = resolved.url;
      formats.push(format);
      // One working CDN is enough for playback; keep scanning only if first failed.
      if (formats.length >= 1 && /s\.ontivi\.net/i.test(resolved.url)) break;
    }

    if (!formats.length) {
      throw new Error("ontivi: decoded stream URL but CDN playlist was unreachable");
    }

    const id = channelIdFromSlug(match.groups.slug);
    const titleRaw = html.match(TITLE_RE)?.[1]?.trim();
    const title = titleRaw?.replace(/\s+онлайн$/i, "").trim() || id;
    const thumbPath = html.match(THUMB_RE)?.[1];
    const thumbnail = thumbPath ? absUrl(thumbPath, origin) : null;

    return baseInfo(OntiviIE.IE_NAME, pageUrl, {
      id,
      display_id: id,
      title,
      thumbnail,
      live_status: "is_live",
      age_limit: 0,
      formats,
    });
  }

  async listVideos(url: string, options: ListVideosOptions = {}): Promise<VideoListResult> {
    if (!OntiviIE.listUrlSupported(url) && !LIST_URL.test(url)) {
      throw new Error("ontivi: not a listing URL (use /tv3 or /chanel?catgl=1)");
    }

    let origin = DEFAULT_ORIGIN;
    try {
      origin = new URL(url).origin;
    } catch {
      /* keep default */
    }

    const listUrl = /\/chanel/i.test(url)
      ? url
      : absUrl(DEFAULT_LIST_PATH, origin);

    const html = await this.request.text(listUrl, {
      headers: {
        Accept: "text/html,*/*",
        Referer: `${origin}/`,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    let entries = parseChannelTiles(html, origin).map(ch => ({
      id: ch.id,
      url: ch.url,
      title: ch.title,
      display_id: ch.id,
    }));

    if (options.limit && options.limit > 0) entries = entries.slice(0, options.limit);

    return {
      extractor: OntiviIE.IE_NAME,
      webpage_url: /\/chanel/i.test(url) ? listUrl : absUrl("/tv3", origin),
      playlist_id: "channels",
      playlist_title: "Ontivi TV",
      page: 1,
      entries,
      next_page_url: null,
    };
  }

  async listCategories(
    url = `${DEFAULT_ORIGIN}/tv3`,
    options: { limit?: number } = {},
  ): Promise<CategoryListResult> {
    let origin = DEFAULT_ORIGIN;
    try {
      origin = new URL(url).origin;
    } catch {
      /* keep default */
    }

    let entries = [
      {
        id: "all",
        title: "All channels",
        url: absUrl("/tv3", origin),
      },
      {
        id: "catgl-1",
        title: "Channel grid",
        url: absUrl(DEFAULT_LIST_PATH, origin),
      },
    ];
    if (options.limit && options.limit > 0) entries = entries.slice(0, options.limit);

    return {
      extractor: OntiviIE.IE_NAME,
      webpage_url: absUrl("/tv3", origin),
      entries,
    };
  }

  /**
   * Follow Ontivi's gate playlist redirect to an absolute playable m3u8.
   * Gate URLs look like `https://s.ontivi.net/{id}/index.m3u8?k=…` and 302 to
   * `/{22-char-token}/{id}/{epoch}/index.m3u8` (relative Location). Returning the
   * gate URL breaks some players that mishandle relative redirects.
   */
  private async resolvePlayableHls(
    gateUrl: string,
    headers: Record<string, string>,
  ): Promise<{ url: string } | null> {
    try {
      const accept = "application/vnd.apple.mpegurl,application/x-mpegURL,*/*";
      const probe = await fetch(gateUrl, {
        method: "GET",
        redirect: "manual",
        headers: { ...headers, Accept: accept },
      });

      let playUrl = gateUrl;
      if (probe.status >= 300 && probe.status < 400) {
        const location = probe.headers.get("location");
        if (!location) return null;
        playUrl = absUrl(location, gateUrl);
      } else if (probe.ok) {
        const body = await probe.text();
        return body.includes("#EXTM3U") ? { url: gateUrl } : null;
      } else {
        return null;
      }

      const playlist = await this.request.text(playUrl, {
        headers: { ...headers, Accept: accept },
      });
      if (!playlist.includes("#EXTM3U")) return null;
      return { url: playUrl };
    } catch {
      return null;
    }
  }

  private async loadPlayerConfig(pageHtml: string, origin: string): Promise<OntiviPlayerConfig> {
    if (cachedPlayerConfig && Date.now() - cachedPlayerConfigAt < PLAYER_CONFIG_TTL_MS) {
      return cachedPlayerConfig;
    }

    const scriptPath = pageHtml.match(PLAYER_SRC_RE)?.[1] || "/p13.js";
    const scriptUrl = absUrl(scriptPath, origin);
    try {
      const js = await this.request.text(scriptUrl, {
        headers: {
          Referer: `${origin}/`,
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      cachedPlayerConfig = parseOntiviPlayerConfig(js);
      cachedPlayerConfigAt = Date.now();
      return cachedPlayerConfig;
    } catch {
      return { ...DEFAULT_ONTIVI_PLAYER_CONFIG };
    }
  }
}
