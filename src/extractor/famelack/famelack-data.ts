import type { CategoryListEntry } from "../_shared/page-links";
import type { VideoListEntry } from "../../core/video-list";
import type { RequestClient } from "../../networking/request";

export const FAMELACK_DATA_ROOT =
  "https://raw.githubusercontent.com/famelack/famelack-data/main/tv/raw";

export const FAMELACK_TV_CATEGORIES = [
  "animation",
  "auto",
  "business",
  "classic",
  "comedy",
  "cooking",
  "culture",
  "documentary",
  "education",
  "entertainment",
  "family",
  "general",
  "interactive",
  "kids",
  "legislative",
  "lifestyle",
  "movies",
  "music",
  "news",
  "outdoor",
  "public",
  "relax",
  "religious",
  "science",
  "series",
  "shop",
  "show",
  "sports",
  "top-news",
  "travel",
  "weather",
] as const;

export interface RawFamelackChannel {
  nanoid: string;
  name?: string;
  sources?: { streams?: string[]; youtube?: string[] };
  languages?: string[];
  country?: string;
  isGeoBlocked?: boolean;
}

export interface FamelackChannel {
  nanoid: string;
  name: string;
  country: string | null;
  languages: string[];
  streamUrls: string[];
  youtubeUrls: string[];
  isGeoBlocked: boolean;
}

export interface FamelackCountryMeta {
  country: string;
  capital?: string;
  timeZone?: string;
  hasChannels?: boolean;
  channelCount?: number;
}

const metadataCache = new Map<string, Record<string, FamelackCountryMeta>>();
const channelListCache = new Map<string, RawFamelackChannel[]>();

export function isCountryScope(scope: string): boolean {
  return /^[a-z]{2}$/i.test(scope);
}

export function channelPageUrl(scope: string, nanoid: string): string {
  return `https://famelack.com/tv/${scope.toLowerCase()}/${nanoid}`;
}

export function listingPageUrl(scope: string): string {
  return `https://famelack.com/tv/${scope.toLowerCase()}`;
}

function titleCaseSlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeChannel(raw: RawFamelackChannel): FamelackChannel {
  const streams = raw.sources?.streams || [];
  const youtube = raw.sources?.youtube || [];
  return {
    nanoid: raw.nanoid,
    name: raw.name?.trim() || "[Unnamed]",
    country: raw.country?.toLowerCase() || null,
    languages: Array.isArray(raw.languages) ? raw.languages.filter(Boolean) : [],
    streamUrls: streams.filter(Boolean),
    youtubeUrls: youtube.filter(Boolean),
    isGeoBlocked: Boolean(raw.isGeoBlocked),
  };
}

function youtubeWatchUrl(embedOrWatchUrl: string): string | null {
  const m =
    embedOrWatchUrl.match(/(?:embed\/|v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/) ||
    embedOrWatchUrl.match(/^([A-Za-z0-9_-]{11})$/);
  const id = m?.[1];
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

export function youtubeWatchUrls(channel: FamelackChannel): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of channel.youtubeUrls) {
    const watch = youtubeWatchUrl(raw);
    if (!watch || seen.has(watch)) continue;
    seen.add(watch);
    out.push(watch);
  }
  return out;
}

export async function fetchCountriesMetadata(
  request: RequestClient,
): Promise<Record<string, FamelackCountryMeta>> {
  const cached = metadataCache.get("tv");
  if (cached) return cached;

  const data = await request.json<Record<string, FamelackCountryMeta>>(
    `${FAMELACK_DATA_ROOT}/countries_metadata.json`,
  );
  metadataCache.set("tv", data);
  return data;
}

async function fetchChannelList(
  request: RequestClient,
  kind: "countries" | "categories",
  scope: string,
): Promise<RawFamelackChannel[]> {
  const key = `${kind}:${scope.toLowerCase()}`;
  const cached = channelListCache.get(key);
  if (cached) return cached;

  const data = await request.json<RawFamelackChannel[]>(
    `${FAMELACK_DATA_ROOT}/${kind}/${scope.toLowerCase()}.json`,
  );
  const list = Array.isArray(data) ? data : [];
  channelListCache.set(key, list);
  return list;
}

export async function fetchScopeChannels(
  request: RequestClient,
  scope: string,
): Promise<RawFamelackChannel[]> {
  const normalized = scope.trim().toLowerCase();
  if (!normalized) throw new Error("famelack: missing country or category scope");
  if (isCountryScope(normalized)) {
    return fetchChannelList(request, "countries", normalized);
  }
  return fetchChannelList(request, "categories", normalized);
}

export async function findChannel(
  request: RequestClient,
  scope: string,
  nanoid: string,
): Promise<FamelackChannel | null> {
  const list = await fetchScopeChannels(request, scope);
  const raw = list.find(entry => entry.nanoid === nanoid);
  return raw ? normalizeChannel(raw) : null;
}

export function channelsToListEntries(
  channels: RawFamelackChannel[],
  scope: string,
): VideoListEntry[] {
  return channels.map(raw => {
    const channel = normalizeChannel(raw);
    return {
      id: channel.nanoid,
      url: channelPageUrl(scope, channel.nanoid),
      title: channel.name,
      display_id: channel.nanoid,
    };
  });
}

export async function buildCountryCategories(
  request: RequestClient,
): Promise<CategoryListEntry[]> {
  const metadata = await fetchCountriesMetadata(request);
  return Object.entries(metadata)
    .filter(([, meta]) => meta.hasChannels && (meta.channelCount ?? 0) > 0)
    .map(([code, meta]) => ({
      id: code,
      title: meta.country,
      url: listingPageUrl(code),
      display_id: code.toLowerCase(),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function buildTvCategoryIndex(): CategoryListEntry[] {
  return FAMELACK_TV_CATEGORIES.map(slug => ({
    id: slug,
    title: titleCaseSlug(slug),
    url: listingPageUrl(slug),
    display_id: slug,
  }));
}
