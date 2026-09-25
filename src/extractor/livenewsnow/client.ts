import type { RequestClient } from "../../networking/request";

export const LNN_ORIGIN = "https://www.livenewsnow.com";
export const LNN_HOME_URL = `${LNN_ORIGIN}/`;
export const LNN_CATEGORIES = ["american", "business"] as const;
export type LnnCategoryId = (typeof LNN_CATEGORIES)[number];

/** Channel pages live under these path prefixes. */
export const LNN_CHANNEL_SECTIONS = ["american", "business", "featured"] as const;
export type LnnChannelSection = (typeof LNN_CHANNEL_SECTIONS)[number];

export const LNN_REQUEST_HEADERS: Record<string, string> = {
  Accept: "text/html,application/xhtml+xml",
  Referer: `${LNN_ORIGIN}/`,
  Origin: LNN_ORIGIN,
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
};

export const LNN_STREAM_HEADERS: Record<string, string> = {
  Referer: `${LNN_ORIGIN}/`,
  Origin: LNN_ORIGIN,
  Accept: "*/*",
};

export interface LnnCategory {
  id: LnnCategoryId;
  title: string;
  url: string;
}

export interface LnnChannel {
  /** Path slug, e.g. `foxnews` or `cnbc`. */
  id: string;
  /** Prefer section/slug when section is not the category default, else slug. */
  displayId: string;
  section: LnnChannelSection;
  title: string;
  pageUrl: string;
  thumbnail: string | null;
  categoryIds: LnnCategoryId[];
}

export interface LnnStreamInfo {
  channelId: string;
  title: string;
  streamUrl: string;
  pageUrl: string;
  thumbnail: string | null;
  section: LnnChannelSection | null;
}

const CATEGORY_TITLES: Record<LnnCategoryId, string> = {
  american: "American",
  business: "Business",
};

/** Match channel HTML pages: `/american/cnbc.html`, `/featured/foxnews`. */
export const CHANNEL_PAGE_URL =
  /^https?:\/\/(?:www\.)?livenewsnow\.com\/(?<section>american|business|featured)\/(?<slug>[a-z0-9-]+)(?:\.html)?\/?(?:[?#]|$)/i;

/** Category listing pages. */
export const CATEGORY_PAGE_URL =
  /^https?:\/\/(?:www\.)?livenewsnow\.com\/category\/(?<id>american|business)\/?(?:[?#]|$)/i;

/** Signed HLS on livenewsplay(er).com (token/expires/sig or sec-/newz- params). */
export const SIGNED_HLS_URL =
  /^https?:\/\/(?:[\w.-]+\.)?livenewsplay(?:er)?\.com(?::\d+)?\/[^\s]+\.m3u8(?:\?[^\s]*)?$/i;

export function lnnCategoryUrl(id: LnnCategoryId): string {
  return `${LNN_ORIGIN}/category/${id}`;
}

export function lnnChannelPageUrl(section: LnnChannelSection, slug: string): string {
  return `${LNN_ORIGIN}/${section}/${slug}.html`;
}

export function listLnnCategories(): LnnCategory[] {
  return LNN_CATEGORIES.map(id => ({
    id,
    title: CATEGORY_TITLES[id],
    url: lnnCategoryUrl(id),
  }));
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

/** Unescape JS/JSON string fragments (`\\u0026`, `\\/`, etc.). */
export function unescapeJsString(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw
      .replace(/\\\//g, "/")
      .replace(/\\u0026/gi, "&")
      .replace(/\\u002f/gi, "/")
      .replace(/&amp;/g, "&");
  }
}

function normalizeChannelPageUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    let path = u.pathname.replace(/\/+$/, "");
    if (!/\.html$/i.test(path)) path = `${path}.html`;
    u.pathname = path;
    return u.toString();
  } catch {
    return url;
  }
}

export function parseChannelPageUrl(url: string): {
  section: LnnChannelSection;
  slug: string;
  pageUrl: string;
} | null {
  const m = url.match(CHANNEL_PAGE_URL);
  if (!m?.groups?.section || !m.groups.slug) return null;
  const section = m.groups.section.toLowerCase() as LnnChannelSection;
  const slug = m.groups.slug.toLowerCase();
  return { section, slug, pageUrl: lnnChannelPageUrl(section, slug) };
}

export function parseCategoryPageUrl(url: string): LnnCategoryId | null {
  const m = url.match(CATEGORY_PAGE_URL);
  const id = m?.groups?.id?.toLowerCase();
  if (id === "american" || id === "business") return id;
  return null;
}

/** Parse `livenewsnow:foxnews`, `livenewsnow:featured/foxnews`, `livenewsnow:american`. */
export function parseLnnPseudoId(raw: string): {
  kind: "categories" | "category" | "channel";
  categoryId?: LnnCategoryId;
  section?: LnnChannelSection;
  slug?: string;
} | null {
  const key = raw.trim().toLowerCase().replace(/\.html$/, "");
  if (!key || key === "categories" || key === "category") {
    return { kind: "categories" };
  }
  if (key === "american" || key === "business") {
    return { kind: "category", categoryId: key };
  }
  const path = key.match(/^(?<section>american|business|featured)\/(?<slug>[a-z0-9-]+)$/);
  if (path?.groups?.section && path.groups.slug) {
    return {
      kind: "channel",
      section: path.groups.section as LnnChannelSection,
      slug: path.groups.slug,
    };
  }
  if (/^[a-z0-9-]+$/.test(key)) {
    return { kind: "channel", slug: key };
  }
  return null;
}

function displayIdFor(section: LnnChannelSection, slug: string): string {
  // Prefer bare slug; section/slug when needed for disambiguation by callers.
  return slug || `${section}/${slug}`;
}

/** Extract a playable signed HLS URL from a channel page body. */
export function extractSignedStreamUrl(html: string): string | null {
  // 1) Player config JSON: {"channel":"foxnews","streamUrl":"…\u0026…"}
  const streamUrlField = html.match(
    /["']streamUrl["']\s*:\s*["']([^"']+)["']/i,
  );
  if (streamUrlField?.[1]) {
    const url = unescapeJsString(streamUrlField[1]).trim();
    if (SIGNED_HLS_URL.test(url) || /\.m3u8(?:\?|$)/i.test(url)) return url;
  }

  // 2) JWPlayer-style `file:` / `var url =`
  const jwPatterns = [
    /\bfile\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
    /\b(?:var|let|const)\s+url\s*=\s*["']([^"']+\.m3u8[^"']*)["']/i,
    /\bsources?\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
  ];
  for (const re of jwPatterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const url = unescapeJsString(m[1]).trim();
      if (/\.m3u8(?:\?|$)/i.test(url)) return url;
    }
  }

  // 3) Any livenewsplay(er) m3u8 with query (allow escaped ampersands in source)
  const broad = html.match(
    /https?:\\?\/\\?\/(?:[\w.-]+\.)?livenewsplay(?:er)?\.com(?::\d+)?(?:\\?\/[^\s"'<>]+?)\.m3u8(?:\?|\\u0026|&amp;|&)[^\s"'<>]*/i,
  );
  if (broad?.[0]) {
    const url = unescapeJsString(broad[0]).split(/["'\s]/)[0]!;
    if (/\.m3u8(?:\?|$)/i.test(url)) return url;
  }

  // 4) Plain unescaped host URL
  const plain = html.match(
    /https:\/\/(?:[\w.-]+\.)?livenewsplay(?:er)?\.com(?::\d+)?\/[^\s"'<>]+\.m3u8\?[^\s"'<>]+/i,
  );
  if (plain?.[0]) return plain[0].replace(/&amp;/g, "&");

  // 5) Third-party HLS embedded via JWPlayer (e.g. CBSN) — still playable
  const anyM3u8 = html.match(/\bfile\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
  if (anyM3u8?.[1]) return unescapeJsString(anyM3u8[1]).trim();

  return null;
}

export function parseChannelMeta(html: string, fallbackTitle: string): {
  title: string;
  thumbnail: string | null;
  channelKey: string | null;
} {
  let channelKey: string | null = null;
  let configTitle: string | null = null;
  const channelField = html.match(/["']channel["']\s*:\s*["']([^"']+)["']/i);
  if (channelField?.[1]) channelKey = channelField[1].trim().toLowerCase();
  const titleField = html.match(/["']title["']\s*:\s*["']([^"']+)["']/i);
  if (titleField?.[1]) configTitle = decodeHtml(titleField[1].trim());

  const ogTitle =
    html.match(/property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/content=["']([^"']+)["']\s+property=["']og:title["']/i)?.[1] ||
    null;
  const docTitle = html.match(/<title[^>]*>\s*([^<]+?)\s*<\/title>/i)?.[1] || null;
  const thumbnail =
    html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i)?.[1] ||
    null;

  const title =
    configTitle ||
    (ogTitle ? decodeHtml(ogTitle) : null) ||
    (docTitle ? decodeHtml(docTitle.replace(/\s+/g, " ").trim()) : null) ||
    fallbackTitle;

  return { title, thumbnail, channelKey };
}

/** Parse channel cards from a category archive page. */
export function parseCategoryChannelsHtml(
  html: string,
  categoryId: LnnCategoryId,
  pageUrl = lnnCategoryUrl(categoryId),
): LnnChannel[] {
  const byPage = new Map<string, LnnChannel>();

  const entryRe =
    /<h3[^>]*class="[^"]*entry-title[^"]*"[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*(?:title="([^"]*)")?[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(html))) {
    const href = absUrl(m[1]!, pageUrl);
    const parsed = parseChannelPageUrl(href);
    if (!parsed) continue;

    const titleAttr = m[2] ? decodeHtml(m[2]) : "";
    const inner = decodeHtml(m[3]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
    const title = titleAttr || inner || parsed.slug;
    const page = normalizeChannelPageUrl(parsed.pageUrl);
    const existing = byPage.get(page);
    if (existing) {
      if (!existing.categoryIds.includes(categoryId)) existing.categoryIds.push(categoryId);
      continue;
    }
    byPage.set(page, {
      id: parsed.slug,
      displayId: displayIdFor(parsed.section, parsed.slug),
      section: parsed.section,
      title,
      pageUrl: page,
      thumbnail: null,
      categoryIds: [categoryId],
    });
  }

  return [...byPage.values()];
}

export async function discoverLnnCategoryChannels(
  request: RequestClient,
  categoryId: LnnCategoryId,
): Promise<LnnChannel[]> {
  const pageUrl = lnnCategoryUrl(categoryId);
  const html = await request.text(pageUrl, { headers: { ...LNN_REQUEST_HEADERS } });
  const channels = parseCategoryChannelsHtml(html, categoryId, pageUrl);
  if (!channels.length) {
    throw new Error(`livenewsnow: no channels found in category ${categoryId}`);
  }
  return channels;
}

export async function discoverAllLnnChannels(request: RequestClient): Promise<LnnChannel[]> {
  const byPage = new Map<string, LnnChannel>();
  for (const cat of LNN_CATEGORIES) {
    const channels = await discoverLnnCategoryChannels(request, cat);
    for (const ch of channels) {
      const existing = byPage.get(ch.pageUrl);
      if (!existing) {
        byPage.set(ch.pageUrl, { ...ch, categoryIds: [...ch.categoryIds] });
        continue;
      }
      for (const id of ch.categoryIds) {
        if (!existing.categoryIds.includes(id)) existing.categoryIds.push(id);
      }
    }
  }
  return [...byPage.values()];
}

export async function resolveLnnChannel(
  request: RequestClient,
  ref: { section?: LnnChannelSection; slug: string },
): Promise<LnnChannel> {
  const slug = ref.slug.toLowerCase();
  if (ref.section) {
    return {
      id: slug,
      displayId: displayIdFor(ref.section, slug),
      section: ref.section,
      title: slug,
      pageUrl: lnnChannelPageUrl(ref.section, slug),
      thumbnail: null,
      categoryIds: [],
    };
  }

  const all = await discoverAllLnnChannels(request);
  const matches = all.filter(c => c.id === slug || c.displayId === slug);
  if (!matches.length) {
    // Fallback: try common sections directly
    for (const section of LNN_CHANNEL_SECTIONS) {
      const pageUrl = lnnChannelPageUrl(section, slug);
      try {
        const info = await extractLnnStreamFromPage(request, pageUrl);
        return {
          id: info.channelId,
          displayId: slug,
          section: info.section || section,
          title: info.title,
          pageUrl: info.pageUrl,
          thumbnail: info.thumbnail,
          categoryIds: [],
        };
      } catch {
        /* try next */
      }
    }
    throw new Error(`livenewsnow: unknown channel ${ref.slug}`);
  }
  // Prefer featured / american when duplicates exist
  const prefer = ["featured", "american", "business"] as const;
  matches.sort(
    (a, b) => prefer.indexOf(a.section) - prefer.indexOf(b.section),
  );
  return matches[0]!;
}

export async function extractLnnStreamFromPage(
  request: RequestClient,
  pageUrl: string,
): Promise<LnnStreamInfo> {
  const parsed = parseChannelPageUrl(pageUrl);
  const normalized = parsed?.pageUrl || normalizeChannelPageUrl(pageUrl);
  const html = await request.text(normalized, { headers: { ...LNN_REQUEST_HEADERS } });
  const streamUrl = extractSignedStreamUrl(html);
  if (!streamUrl) {
    throw new Error(`livenewsnow: no stream URL found on ${normalized}`);
  }
  const meta = parseChannelMeta(html, parsed?.slug || "Live News Now");
  return {
    channelId: meta.channelKey || parsed?.slug || "live",
    title: meta.title,
    streamUrl,
    pageUrl: normalized,
    thumbnail: meta.thumbnail,
    section: parsed?.section || null,
  };
}
