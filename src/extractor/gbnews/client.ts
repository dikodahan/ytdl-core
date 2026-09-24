import { createHash } from "crypto";
import type { RequestClient } from "../../networking/request";

export const GBNEWS_ORIGIN = "https://www.gbnews.com";
export const GBNEWS_LIVE_URL = `${GBNEWS_ORIGIN}/watch/live`;
export const GBNEWS_CHANNELS_URL = GBNEWS_LIVE_URL;

export const PERCEPTION_ORIGIN = "https://gbnews.perception.tv";
export const PERCEPTION_CLIENT_ID = "2114590823908139151";
/** Signing secret embedded in perception.min.js (`ve.Rt`). */
export const PERCEPTION_CLIENT_SECRET = "2409d1da-0384-4a5e-b52c-142fe28eaf41";
export const PERCEPTION_API_VERSION = "11.10";
export const PERCEPTION_API_FORMAT = "json";
/** Default channel currently embedded as `player/tv/385` on watch/live. */
export const PERCEPTION_DEFAULT_CHANNEL_ID = "385";

export const HLS_CLIENT_PARAMS =
  "client=hlsjs&version=v1.6.15-Fora2&v=6&initialBandwidthLimit=2097153";

export interface GbnewsChannel {
  /** Perception channel id (e.g. `385`). */
  id: string;
  /** Channel slug: gbn1 / gbn2 / live / live-2 */
  slug: string;
  title: string;
  pageUrl: string;
  thumbnail: string | null;
}

export interface GbnewsStreamInfo {
  channelId: string;
  streamUrl: string;
  title: string;
  thumbnail: string | null;
  pageUrl: string;
}

const DEFAULT_CHANNELS: Array<Omit<GbnewsChannel, "thumbnail"> & { thumbnail?: string | null }> = [
  {
    id: PERCEPTION_DEFAULT_CHANNEL_ID,
    slug: "gbn1",
    title: "GBN 1 Live",
    pageUrl: `${GBNEWS_ORIGIN}/watch/live`,
  },
  {
    id: PERCEPTION_DEFAULT_CHANNEL_ID,
    slug: "gbn2",
    title: "GBN 2 Live",
    pageUrl: `${GBNEWS_ORIGIN}/watch/live-2`,
  },
];

const SLUG_ALIASES: Record<string, string> = {
  gbn1: "gbn1",
  "gbn-1": "gbn1",
  live: "gbn1",
  "1": "gbn1",
  gbn2: "gbn2",
  "gbn-2": "gbn2",
  "live-2": "gbn2",
  "2": "gbn2",
};

export function normalizeGbnewsChannelId(raw: string): string {
  const key = raw.trim().toLowerCase();
  return SLUG_ALIASES[key] || key;
}

export function gbnewsChannelPageUrl(slugOrId: string): string {
  const slug = normalizeGbnewsChannelId(slugOrId);
  if (slug === "gbn2" || slug === "live-2") return `${GBNEWS_ORIGIN}/watch/live-2`;
  return GBNEWS_LIVE_URL;
}

function absUrl(pathOrUrl: string, base: string): string {
  try {
    return new URL(pathOrUrl, base).toString();
  } catch {
    return pathOrUrl;
  }
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function md5(s: string): string {
  return createHash("md5").update(s, "utf8").digest("hex");
}

function perceptionSigningKey(): string {
  return (
    PERCEPTION_CLIENT_SECRET +
    PERCEPTION_API_VERSION +
    PERCEPTION_API_FORMAT +
    PERCEPTION_CLIENT_ID
  );
}

function perceptionApiPrefix(): string {
  return (
    `Catherine/api/${PERCEPTION_API_VERSION}/${PERCEPTION_API_FORMAT}/` +
    `${PERCEPTION_CLIENT_ID}/`
  );
}

/** Append browser-equivalent HLS client query params required for playback. */
export function withHlsClientParams(streamUrl: string): string {
  const url = new URL(streamUrl);
  if (!url.searchParams.has("client")) url.searchParams.set("client", "hlsjs");
  if (!url.searchParams.has("version")) url.searchParams.set("version", "v1.6.15-Fora2");
  if (!url.searchParams.has("v")) url.searchParams.set("v", "6");
  if (!url.searchParams.has("initialBandwidthLimit")) {
    url.searchParams.set("initialBandwidthLimit", "2097153");
  }
  return url.toString();
}

interface PerceptionPlatformInfo {
  key?: string;
  defaultSegmentDuration?: string | number;
  defaultNumberOfSegmentsForLive?: string | number;
  errorType?: number;
  errorDetails?: { errorDescription?: string };
}

interface PerceptionChannelRow {
  id?: number | string;
  name?: string;
  mediumName?: string;
  shortName?: string;
  number?: number;
  type?: string;
}

interface PerceptionGetUrlResponse {
  url?: string;
  errorType?: number;
  errorDetails?: { errorDescription?: string; argumentReference?: string };
}

export async function perceptionCall<T>(
  request: RequestClient,
  action: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const body = JSON.stringify(payload);
  const path = `client/${action}`;
  const sig = md5(perceptionSigningKey() + path + body);
  const url = `${PERCEPTION_ORIGIN}/${perceptionApiPrefix()}${sig}/${path}`;
  return request.json<T>(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: PERCEPTION_ORIGIN,
      Referer: `${PERCEPTION_ORIGIN}/player/tv/${PERCEPTION_DEFAULT_CHANNEL_ID}`,
    },
    body,
  });
}

export async function createPerceptionSession(request: RequestClient): Promise<{
  sessionId: string;
  segmentDuration: number;
  numberOfSegmentsForLive: number;
}> {
  const plat = await perceptionCall<PerceptionPlatformInfo>(request, "getPlatformInformation", {
    locale: "en-GB",
    appVersion: 1,
    deviceWidth: 1,
    deviceHeight: 1,
  });
  if (!plat.key) {
    throw new Error(
      `gbnews: Perception session failed (${plat.errorDetails?.errorDescription || "no key"})`,
    );
  }
  return {
    sessionId: plat.key,
    segmentDuration: Number(plat.defaultSegmentDuration) || 10000,
    numberOfSegmentsForLive: Number(plat.defaultNumberOfSegmentsForLive) || 3,
  };
}

function playbackFormats(segmentDuration: number, numberOfSegmentsForLive: number) {
  return [
    {
      protocol: "HLS",
      audioFormats: ["AAC"],
      container: "TS",
      videoCodecs: ["H264"],
      numberOfSegmentsForLive,
      segmentDuration,
      drmTypes: ["CLEAR_KEY"],
      subtitleFormats: ["WEBVTT"],
    },
  ];
}

/** Resolve a playable Perception HLS URL (includes `mwk` token). */
export async function fetchPerceptionStreamUrl(
  request: RequestClient,
  channelId: string | number,
): Promise<string> {
  const session = await createPerceptionSession(request);
  const res = await perceptionCall<PerceptionGetUrlResponse>(request, "channels/linear/getUrl", {
    locale: "en-GB",
    sessionId: session.sessionId,
    channelId: Number(channelId) || channelId,
    channelType: "TV",
    playbackType: "LIVE",
    delay: 0,
    secureHttp: true,
    bookmarksImageInfo: [],
    playbackFormats: playbackFormats(session.segmentDuration, session.numberOfSegmentsForLive),
  });
  if (!res.url) {
    throw new Error(
      `gbnews: Perception getUrl failed for channel ${channelId}` +
        (res.errorDetails?.errorDescription ? ` (${res.errorDetails.errorDescription})` : ""),
    );
  }
  return withHlsClientParams(res.url);
}

export async function listPerceptionChannels(request: RequestClient): Promise<
  Array<{ id: string; title: string; number: number | null }>
> {
  const session = await createPerceptionSession(request);
  const data = await perceptionCall<{ channels?: PerceptionChannelRow[] }>(
    request,
    "channels/list",
    {
      locale: "en-GB",
      sessionId: session.sessionId,
      type: "TV",
    },
  );
  return (data.channels || []).map((ch, i) => ({
    id: String(ch.id ?? ""),
    title: ch.name || ch.mediumName || ch.shortName || `GB News ${ch.id}`,
    number: ch.number != null ? Number(ch.number) : i + 1,
  }));
}

/** Parse Perception channel id / legacy player attrs from a watch page. */
export function parseGbnewsPlayerConfig(html: string): {
  channelId: string | null;
  thumbnail: string | null;
  title: string | null;
} {
  const perception =
    html.match(/gbnews\.perception\.tv\/player\/tv\/(?<id>\d+)/i)?.groups?.id || null;
  const thumb =
    html.match(
      /https?:\/\/thumbnails\.simplestreamcdn\.com\/gbnews\/channel\/\d+\.jpg[^"'<\s]*/i,
    )?.[0] ||
    html.match(/data-poster=["']([^"']+)["']/i)?.[1] ||
    null;
  const h1 = html.match(/<h1[^>]*>\s*([\s\S]*?)\s*<\/h1>/i)?.[1];
  const title = h1
    ? decodeHtml(h1.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())
    : null;
  return { channelId: perception, thumbnail: thumb, title };
}

/** Discover GBN 1 / GBN 2 entries from the live watch page markup. */
export function parseGbnewsChannelsHtml(html: string, pageUrl = GBNEWS_LIVE_URL): GbnewsChannel[] {
  const player = parseGbnewsPlayerConfig(html);
  const defaultId = player.channelId || PERCEPTION_DEFAULT_CHANNEL_ID;
  const defaultThumb = player.thumbnail;

  const bySlug = new Map<string, GbnewsChannel>();
  const linkRe =
    /href="((?:https?:\/\/(?:www\.)?gbnews\.com)?\/watch\/live(?:-2)?)"[^>]*>\s*([\s\S]*?)\s*<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html))) {
    const href = m[1];
    const label = decodeHtml(m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
    const isGbn2 = /live-2/i.test(href);
    const slug = isGbn2 ? "gbn2" : "gbn1";
    if (bySlug.has(slug)) continue;
    bySlug.set(slug, {
      id: defaultId,
      slug,
      title: label.includes("GBN") ? label : isGbn2 ? "GBN 2 Live" : "GBN 1 Live",
      pageUrl: absUrl(href, pageUrl).replace(/[?#].*$/, ""),
      thumbnail: defaultThumb,
    });
  }

  for (const ch of DEFAULT_CHANNELS) {
    if (bySlug.has(ch.slug)) continue;
    bySlug.set(ch.slug, {
      id: ch.id || defaultId,
      slug: ch.slug,
      title: ch.title,
      pageUrl: ch.pageUrl,
      thumbnail: defaultThumb || null,
    });
  }

  return [...bySlug.values()];
}

export async function discoverGbnewsChannels(request: RequestClient): Promise<GbnewsChannel[]> {
  const html = await request.text(GBNEWS_LIVE_URL, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      Referer: `${GBNEWS_ORIGIN}/`,
    },
  });
  let channels = parseGbnewsChannelsHtml(html, GBNEWS_LIVE_URL);

  // Prefer live Perception channel catalog ids when available.
  try {
    const remote = await listPerceptionChannels(request);
    if (remote.length) {
      const primary = remote[0]!;
      channels = channels.map((ch, i) => ({
        ...ch,
        id: remote[i]?.id || primary.id,
        title: remote[i]?.title || ch.title,
      }));
      // Ensure every Perception channel is represented at least once.
      for (const rem of remote) {
        if (channels.some(c => c.id === rem.id)) continue;
        channels.push({
          id: rem.id,
          slug: rem.id,
          title: rem.title,
          pageUrl: GBNEWS_LIVE_URL,
          thumbnail: null,
        });
      }
    }
  } catch {
    /* keep HTML defaults */
  }

  if (!channels.length) throw new Error("gbnews: no channels found on watch/live");
  return channels;
}

export async function resolveGbnewsChannel(
  request: RequestClient,
  channelRef: string,
): Promise<GbnewsChannel> {
  const raw = channelRef.trim();
  const channels = await discoverGbnewsChannels(request);

  if (/^\d+$/.test(raw)) {
    const byId = channels.find(c => c.id === raw);
    if (byId) return byId;
    return {
      id: raw,
      slug: raw,
      title: `GB News ${raw}`,
      pageUrl: GBNEWS_LIVE_URL,
      thumbnail: null,
    };
  }

  const slug = normalizeGbnewsChannelId(raw);
  const found = channels.find(c => c.slug === slug || c.id === slug);
  if (!found) throw new Error(`gbnews: unknown channel ${channelRef}`);
  return found;
}

/** @deprecated Prefer fetchPerceptionStreamUrl — kept as alias for callers. */
export async function fetchGbnewsStreamUrl(
  request: RequestClient,
  channelId: string,
  _key?: string,
  _playerId?: string,
): Promise<string> {
  return fetchPerceptionStreamUrl(request, channelId);
}

export async function extractGbnewsLiveFromPage(
  request: RequestClient,
  pageUrl: string,
): Promise<GbnewsStreamInfo> {
  const html = await request.text(pageUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      Referer: `${GBNEWS_ORIGIN}/`,
    },
  });
  const cfg = parseGbnewsPlayerConfig(html);
  const channelId = cfg.channelId || PERCEPTION_DEFAULT_CHANNEL_ID;
  const streamUrl = await fetchPerceptionStreamUrl(request, channelId);
  const isGbn2 = /live-2/i.test(pageUrl);
  return {
    channelId,
    streamUrl,
    title: cfg.title || (isGbn2 ? "GBN 2 Live" : "GBN 1 Live"),
    thumbnail: cfg.thumbnail,
    pageUrl,
  };
}
