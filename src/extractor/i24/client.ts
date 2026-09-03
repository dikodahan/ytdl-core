import type { RequestClient } from "../../networking/request";

export const I24_VIDEO_ORIGIN = "https://video.i24news.tv";
export const I24_API_BASE = "https://insight-api-shared.univtec.com/";
export const I24_TENANT_ID = "i24israel";

export const I24_REGIONS_URL = `${I24_VIDEO_ORIGIN}/regions`;

export interface I24RegionInfo {
  regionCode: string;
  displayName: string;
  regionImage?: string;
  pageId: string;
  pageUrl: string;
}

export interface I24LiveChannel {
  id: string;
  title: string;
  videoUrl: string;
  thumbnail?: string | null;
  regionCode: string;
}

interface I24ConfigPage {
  _id: string;
  name?: string;
  main?: boolean;
  sections?: Array<{ id: string; title?: string }>;
}

interface I24ConfigResponse {
  displayName?: string;
  config?: {
    pages?: I24ConfigPage[];
    features?: {
      regions?: {
        regions?: Array<{
          regionCode: string;
          displayName?: string;
          regionImage?: string;
        }>;
      };
    };
  };
}

interface I24SectionItem {
  id?: string;
  title?: string;
  name?: string;
  videoUrl?: string;
  thumbnail?: string;
  image?: string;
  poster?: string;
}

interface I24SectionResponse {
  title?: string;
  items?: I24SectionItem[];
}

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: "application/json",
  Origin: I24_VIDEO_ORIGIN,
  Referer: `${I24_VIDEO_ORIGIN}/`,
  platform: "web",
  "x-device-type": "web",
  "x-tenant-id": I24_TENANT_ID,
  "x-device": "ytdl-core",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
};

export { DEFAULT_HEADERS as I24_REQUEST_HEADERS };

function apiHeaders(regionCode?: string): Record<string, string> {
  const headers = { ...DEFAULT_HEADERS };
  if (regionCode) headers.regioncode = regionCode;
  return headers;
}

async function apiJson<T>(
  request: RequestClient,
  path: string,
  regionCode?: string,
): Promise<T> {
  const url = path.startsWith("http") ? path : `${I24_API_BASE}${path.replace(/^\//, "")}`;
  return request.json<T>(url, { headers: apiHeaders(regionCode) });
}

export async function fetchI24Config(
  request: RequestClient,
  regionCode: string,
): Promise<I24ConfigResponse> {
  return apiJson<I24ConfigResponse>(request, "interface/customers/config", regionCode);
}

export async function fetchI24Section(
  request: RequestClient,
  sectionId: string,
  regionCode: string,
): Promise<I24SectionResponse> {
  return apiJson<I24SectionResponse>(
    request,
    `interface/pages/section/${sectionId}`,
    regionCode,
  );
}

export async function fetchI24Channel(
  request: RequestClient,
  channelId: string,
  regionCode = "all",
): Promise<{ id: string; title: string; videoUrl: string; thumbnail?: string | null }> {
  const data = await apiJson<I24SectionItem[] | I24SectionItem>(
    request,
    `interface/pages/channel/${channelId}`,
    regionCode,
  );
  const item = Array.isArray(data) ? data[0] : data;
  if (!item?.videoUrl) {
    throw new Error(`i24: channel ${channelId} has no videoUrl`);
  }
  return {
    id: item.id || channelId,
    title: item.title || item.name || channelId,
    videoUrl: item.videoUrl,
    thumbnail: item.thumbnail || item.image || item.poster || null,
  };
}

function isLiveSectionTitle(title: string | undefined): boolean {
  const t = (title || "").trim().toLowerCase();
  return t === "live" || t === "שידור חי" || t.includes("live");
}

function isLivePageName(name: string | undefined): boolean {
  const t = (name || "").trim().toLowerCase();
  return t === "live" || t === "שידור חי";
}

function collectLiveSectionIds(pages: I24ConfigPage[]): string[] {
  const ids: string[] = [];
  for (const page of pages) {
    const sections = page.sections || [];
    if (page.main) {
      for (const section of sections) {
        if (isLiveSectionTitle(section.title)) ids.push(section.id);
      }
      continue;
    }
    if (isLivePageName(page.name)) {
      for (const section of sections) ids.push(section.id);
    }
  }
  return [...new Set(ids)];
}

export function i24RegionPageUrl(regionCode: string, pageId: string): string {
  return `${I24_VIDEO_ORIGIN}/r/${regionCode}/page/${pageId}`;
}

export function i24ChannelPageUrl(channelId: string): string {
  return `${I24_VIDEO_ORIGIN}/player/channel/${channelId}`;
}

/** Discover region landing pages from the Univtec config (regions picker). */
export async function discoverI24Regions(request: RequestClient): Promise<I24RegionInfo[]> {
  const base = await fetchI24Config(request, "all");
  const regionDefs = base.config?.features?.regions?.regions || [];
  if (!regionDefs.length) throw new Error("i24: no regions in config");

  const out: I24RegionInfo[] = [];
  for (const def of regionDefs) {
    const regionCode = def.regionCode;
    const cfg = regionCode === "all" ? base : await fetchI24Config(request, regionCode);
    const pages = cfg.config?.pages || [];
    const home = pages.find(p => p.main) || pages[0];
    if (!home?._id) continue;
    out.push({
      regionCode,
      displayName: cfg.displayName || def.displayName || regionCode,
      regionImage: def.regionImage,
      pageId: home._id,
      pageUrl: i24RegionPageUrl(regionCode, home._id),
    });
  }
  return out;
}

/** Live linear channels exposed on a region's home / live sections. */
export async function discoverI24LiveChannels(
  request: RequestClient,
  regionCode: string,
): Promise<I24LiveChannel[]> {
  const cfg = await fetchI24Config(request, regionCode);
  const pages = cfg.config?.pages || [];
  const sectionIds = collectLiveSectionIds(pages);
  const byId = new Map<string, I24LiveChannel>();

  for (const sectionId of sectionIds) {
    const section = await fetchI24Section(request, sectionId, regionCode);
    for (const item of section.items || []) {
      if (!item.id || !item.videoUrl) continue;
      if (byId.has(item.id)) continue;
      byId.set(item.id, {
        id: item.id,
        title: item.title || item.name || item.id,
        videoUrl: item.videoUrl,
        thumbnail: item.thumbnail || item.image || item.poster || null,
        regionCode,
      });
    }
  }

  return [...byId.values()];
}

/** Prefer the channel whose title matches the region language, else first. */
export function pickPrimaryLiveChannel(
  channels: I24LiveChannel[],
  regionCode: string,
): I24LiveChannel | undefined {
  if (!channels.length) return undefined;
  const needles: Record<string, RegExp> = {
    all: /english/i,
    hebrew: /hebrew|עברית/i,
    french: /fran[cç]ais|french/i,
    arabic: /arabic|عرب/i,
  };
  const re = needles[regionCode] || needles.all;
  return channels.find(c => re.test(c.title)) || channels[0];
}
