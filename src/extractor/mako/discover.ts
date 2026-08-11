import type { RequestClient } from "../../networking/request";
import {
  MAKO_CHANNELS,
  type MakoChannel,
} from "./channels";
import { buildAuthorizedMakoUrl, fetchMakoTicket, MAKO_REQUEST_HEADERS } from "./token";

const MAKO_VOD_URL = "https://www.mako.co.il/mako-vod";
const MAKO_ORIGIN = "https://www.mako.co.il";
const LIVE_TV_PREFIX = "/mako-vod-live-tv/";
const NEXT_DATA_RE = /<script id="__NEXT_DATA__"[^>]*>(?<json>[\s\S]*?)<\/script>/i;
const DISCOVERY_TTL_MS = 30 * 60 * 1000;

/** Map site path slugs → stable `mako:{id}` ids. */
const PATH_SLUG_TO_ID: Record<string, string> = {
  "VOD-6540b8dcb64fd31006.htm": "k12",
  "VOD-319a699f834e661006.htm": "k12cc",
  "VOD-b3480d2eff3fd31006.htm": "ch24",
  comedy_nonstop: "free-comedy",
  drama_nonstop: "free-drama",
  music_nonstop: "free-music",
  food_nonstop: "free-food",
  eretz_nehedert_nonstop: "eretz",
  sabri_maranan_nonstop: "savri",
};

/** Map CDN path segments → stable ids (survives VOD-*.htm renames). */
const STREAM_SEGMENT_TO_ID: Record<string, string> = {
  k12: "k12",
  k12dvr: "k12",
  "k12rh-dvr": "k12",
  k12rh: "k12",
  k12n12wad: "k12",
  "k12ni-bu": "k12",
  k12cc: "k12cc",
  k12cc_: "k12cc",
  ch24live: "ch24",
  free_comedy: "free-comedy",
  free_drama: "free-drama",
  free_music: "free-music",
  free_food: "free-food",
  erets: "eretz",
  savri: "savri",
  dancing_with_stars: "dancing",
  ninja: "ninja",
  kohav: "kohav",
  hatuna: "hatuna",
};

export interface MakoSiteListingEntry {
  pageUrl: string;
  title?: string;
  itemVcmId?: string;
}

interface CachedCatalog {
  at: number;
  channels: MakoChannel[];
  source: "site" | "fallback";
}

let cachedCatalog: CachedCatalog | null = null;

function absMakoUrl(pathOrUrl: string): string {
  try {
    return new URL(pathOrUrl, MAKO_ORIGIN).toString();
  } catch {
    return pathOrUrl;
  }
}

function stripUrlQuery(url: string): string {
  const q = url.indexOf("?");
  return q >= 0 ? url.slice(0, q) : url;
}

function parseNextData(html: string): unknown {
  const m = html.match(NEXT_DATA_RE);
  if (!m?.groups?.json) throw new Error("mako: __NEXT_DATA__ missing");
  return JSON.parse(m.groups.json);
}

/** Collect unique `/mako-vod-live-tv/...` cards from CMS JSON. */
export function collectLiveTvEntries(root: unknown): MakoSiteListingEntry[] {
  const out: MakoSiteListingEntry[] = [];
  const seen = new Set<string>();

  const walk = (obj: unknown): void => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (const item of obj) walk(item);
      return;
    }
    const rec = obj as Record<string, unknown>;
    const pageUrlRaw = rec.pageUrl ?? rec.url;
    if (typeof pageUrlRaw === "string" && pageUrlRaw.includes(LIVE_TV_PREFIX)) {
      let path: string;
      try {
        path = new URL(pageUrlRaw, MAKO_ORIGIN).pathname;
      } catch {
        path = pageUrlRaw.split("?")[0];
      }
      // Prefer program/hub pages; skip deep episode URLs that contain `/VOD-` under a season path.
      // Keep top-level `.../VOD-….htm` (LIVE12 / 24 / CC) and `.../*_nonstop`.
      const depth = path.split("/").filter(Boolean).length;
      if (depth <= 2 && !seen.has(path)) {
        seen.add(path);
        out.push({
          pageUrl: path,
          title:
            (typeof rec.title === "string" && rec.title) ||
            (typeof rec.name === "string" && rec.name) ||
            (typeof rec.altText === "string" && rec.altText) ||
            undefined,
          itemVcmId:
            (typeof rec.itemVcmId === "string" && rec.itemVcmId) ||
            (typeof rec.vcmId === "string" && rec.vcmId) ||
            undefined,
        });
      }
    }
    for (const v of Object.values(rec)) walk(v);
  };

  walk(root);
  return out;
}

function streamSegment(streamUrl: string): string | undefined {
  try {
    const parts = new URL(streamUrl).pathname.split("/").filter(Boolean);
    const liveIdx = parts.findIndex(p => p === "live");
    if (liveIdx >= 0 && parts[liveIdx + 2]) {
      return parts[liveIdx + 2].replace(/\.m3u8$/i, "");
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

export function stableIdForSiteChannel(opts: {
  pageUrl: string;
  streamUrl?: string;
  title?: string;
}): string {
  const slug = opts.pageUrl.split("/").filter(Boolean).pop() || "";
  if (PATH_SLUG_TO_ID[slug]) return PATH_SLUG_TO_ID[slug];

  if (opts.streamUrl) {
    const seg = streamSegment(opts.streamUrl);
    if (seg && STREAM_SEGMENT_TO_ID[seg]) return STREAM_SEGMENT_TO_ID[seg];
    if (seg) {
      return seg
        .toLowerCase()
        .replace(/_/g, "-")
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }
  }

  return slug
    .replace(/\.htm$/i, "")
    .replace(/^VOD-/i, "vod-")
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "mako-live";
}

export function groupForChannel(id: string, streamUrl: string): MakoChannel["group"] {
  if (id.startsWith("free-") || /\/free_/i.test(streamUrl)) return "free";
  if (
    id === "k12" ||
    id === "k12cc" ||
    id === "ch24" ||
    id.startsWith("k12-") ||
    /\/(?:k12|ch24)/i.test(streamUrl)
  ) {
    return "live";
  }
  return "extra";
}

function contentUrlFromPlaylistProps(playlist: Record<string, unknown> | undefined): string | undefined {
  if (!playlist) return undefined;
  const seo = playlist.seo as Record<string, unknown> | undefined;
  const schema = seo?.schema as Record<string, unknown> | undefined;
  const video = schema?.video as Record<string, unknown> | undefined;
  const contentUrl = video?.contentUrl;
  return typeof contentUrl === "string" ? contentUrl : undefined;
}

function thumbnailFromPlaylistProps(playlist: Record<string, unknown> | undefined): string | undefined {
  if (!playlist) return undefined;
  const hero = playlist.hero as Record<string, unknown> | undefined;
  const pics = hero?.pics as Array<{ picUrl?: string }> | undefined;
  if (pics?.[0]?.picUrl) return pics[0].picUrl;
  const seo = playlist.seo as Record<string, unknown> | undefined;
  if (typeof seo?.image === "string") return seo.image;
  return undefined;
}

function titleFromPlaylistProps(
  playlist: Record<string, unknown> | undefined,
  fallback?: string,
): string {
  if (playlist) {
    const hero = playlist.hero as Record<string, unknown> | undefined;
    if (typeof hero?.title === "string" && hero.title.trim()) return hero.title.trim();
    const seo = playlist.seo as Record<string, unknown> | undefined;
    const schema = seo?.schema as Record<string, unknown> | undefined;
    if (typeof schema?.name === "string" && schema.name.trim()) return schema.name.trim();
  }
  return fallback?.trim() || "Mako live";
}

async function fetchNextData(request: RequestClient, url: string): Promise<unknown> {
  const html = await request.text(url, { headers: MAKO_REQUEST_HEADERS });
  return parseNextData(html);
}

async function resolveStreamViaPlaylistApi(
  request: RequestClient,
  vod: Record<string, unknown>,
): Promise<{ url?: string; title?: string }> {
  const itemVcmId = typeof vod.itemVcmId === "string" ? vod.itemVcmId : undefined;
  const channelId = typeof vod.channelId === "string" ? vod.channelId : undefined;
  if (!itemVcmId || !channelId) return {};

  const galleryChannelId =
    (typeof vod.galleryChannelId === "string" && vod.galleryChannelId) || itemVcmId;
  const qs = new URLSearchParams({
    jspName: "playlist.jsp",
    vcmid: itemVcmId,
    galleryChannelId,
    videoChannelId: channelId,
    consumer: "web_html5",
    encryption: "no",
    isGallery: "false",
  });

  try {
    const data = await request.json<{
      media?: Array<{ url?: string }>;
      videoDetails?: { title?: string };
    }>(`${MAKO_ORIGIN}/AjaxPage?${qs.toString()}`, { headers: MAKO_REQUEST_HEADERS });
    return {
      url: data.media?.[0]?.url,
      title: data.videoDetails?.title,
    };
  } catch {
    return {};
  }
}

async function resolveSiteChannel(
  request: RequestClient,
  entry: MakoSiteListingEntry,
): Promise<MakoChannel | null> {
  const pageUrl = absMakoUrl(entry.pageUrl);
  let data: unknown;
  try {
    data = await fetchNextData(request, pageUrl);
  } catch {
    return null;
  }

  const pageProps = (data as { props?: { pageProps?: Record<string, unknown> } })?.props?.pageProps;
  const playlist = pageProps?.playlist as Record<string, unknown> | undefined;
  let streamUrl = contentUrlFromPlaylistProps(playlist);
  let title = titleFromPlaylistProps(playlist, entry.title);
  let thumbnail = thumbnailFromPlaylistProps(playlist);
  const vod = (playlist?.vod || {}) as Record<string, unknown>;

  if (!streamUrl) {
    const episodePath = typeof vod.pageUrl === "string" ? vod.pageUrl : undefined;
    if (episodePath) {
      try {
        const epData = await fetchNextData(request, absMakoUrl(episodePath));
        const epProps = (epData as { props?: { pageProps?: Record<string, unknown> } })?.props
          ?.pageProps;
        const epPlaylist = epProps?.playlist as Record<string, unknown> | undefined;
        streamUrl = contentUrlFromPlaylistProps(epPlaylist);
        title = titleFromPlaylistProps(epPlaylist, title);
        thumbnail = thumbnailFromPlaylistProps(epPlaylist) || thumbnail;
      } catch {
        /* fall through to playlist API */
      }
    }
  }

  if (!streamUrl) {
    const viaApi = await resolveStreamViaPlaylistApi(request, vod);
    streamUrl = viaApi.url;
    if (viaApi.title) title = viaApi.title;
  }

  if (!streamUrl || !/mako-streaming\.akamaized\.net/i.test(streamUrl)) return null;

  const cleanStream = stripUrlQuery(streamUrl);
  const id = stableIdForSiteChannel({
    pageUrl: entry.pageUrl,
    streamUrl: cleanStream,
    title,
  });

  return {
    id,
    name: title,
    label: id,
    streamUrl: cleanStream,
    thumbnail,
    group: groupForChannel(id, cleanStream),
  };
}

/** Discover live/linear channels from mako.co.il VOD CMS (no MediaBox). */
export async function discoverMakoChannelsFromSite(
  request: RequestClient,
): Promise<MakoChannel[]> {
  const data = await fetchNextData(request, MAKO_VOD_URL);
  const entries = collectLiveTvEntries(data);
  if (!entries.length) return [];

  const resolved = await Promise.all(entries.map(e => resolveSiteChannel(request, e)));
  const byId = new Map<string, MakoChannel>();
  for (const ch of resolved) {
    if (!ch) continue;
    // Prefer first occurrence (homepage order).
    if (!byId.has(ch.id)) byId.set(ch.id, ch);
  }
  return [...byId.values()];
}

/**
 * Prefer site discovery exclusively when it returns any channels.
 * MediaBox / built-in list is used only when site discovery fails or is empty.
 */
export function selectMakoCatalog(
  siteChannels: MakoChannel[],
  fallback: MakoChannel[] = MAKO_CHANNELS,
): { channels: MakoChannel[]; source: "site" | "fallback" } {
  if (siteChannels.length > 0) {
    return { channels: [...siteChannels], source: "site" };
  }
  return { channels: [...fallback], source: "fallback" };
}

/** @deprecated Use {@link selectMakoCatalog}. Kept for callers expecting a flat list. */
export function mergeMakoCatalog(
  siteChannels: MakoChannel[],
  fallback: MakoChannel[] = MAKO_CHANNELS,
): MakoChannel[] {
  return selectMakoCatalog(siteChannels, fallback).channels;
}

/** True when a tokenized Mako HLS playlist is reachable. */
export async function isMakoStreamPlayable(
  request: RequestClient,
  streamUrl: string,
  tokenUrl?: string,
): Promise<boolean> {
  try {
    const ticket = await fetchMakoTicket(request, tokenUrl || streamUrl);
    const playUrl = buildAuthorizedMakoUrl(streamUrl, ticket);
    const res = await request.request(playUrl, { headers: MAKO_REQUEST_HEADERS });
    return res.statusCode === 200 && /#EXTM3U/i.test(String(res.body || ""));
  } catch {
    return false;
  }
}

/** Drop catalog entries whose CDN paths are dead (used for MediaBox fallback only). */
export async function filterDeadFallbackChannels(
  request: RequestClient,
  channels: MakoChannel[],
): Promise<MakoChannel[]> {
  const checks = await Promise.all(
    channels.map(async ch => {
      const ok = await isMakoStreamPlayable(request, ch.streamUrl, ch.tokenUrl);
      return ok ? ch : null;
    }),
  );
  return checks.filter((c): c is MakoChannel => !!c);
}

/** Cached site catalog, or MediaBox fallback when discovery fails. */
export async function getMakoCatalog(
  request: RequestClient,
  options: { forceRefresh?: boolean; group?: MakoChannel["group"] } = {},
): Promise<{ channels: MakoChannel[]; source: CachedCatalog["source"] }> {
  if (
    !options.forceRefresh &&
    cachedCatalog &&
    Date.now() - cachedCatalog.at < DISCOVERY_TTL_MS
  ) {
    const channels = options.group
      ? cachedCatalog.channels.filter(c => c.group === options.group)
      : cachedCatalog.channels;
    return { channels, source: cachedCatalog.source };
  }

  let site: MakoChannel[] = [];
  try {
    site = await discoverMakoChannelsFromSite(request);
  } catch {
    site = [];
  }

  const selected = selectMakoCatalog(site, MAKO_CHANNELS);
  const channelsAlive =
    selected.source === "fallback"
      ? await filterDeadFallbackChannels(request, selected.channels)
      : selected.channels;

  cachedCatalog = {
    at: Date.now(),
    channels: channelsAlive,
    source: selected.source,
  };
  const channels = options.group
    ? channelsAlive.filter(c => c.group === options.group)
    : channelsAlive;
  return { channels, source: selected.source };
}

export function findInMakoCatalog(
  channels: MakoChannel[],
  id: string,
): MakoChannel | undefined {
  const key = id.trim().toLowerCase();
  return channels.find(c => c.id.toLowerCase() === key);
}

/** Test helper — clear discovery cache. */
export function clearMakoDiscoveryCache(): void {
  cachedCatalog = null;
}
