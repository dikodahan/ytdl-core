import type { VideoListEntry } from "../../core/video-list";

/** Resolve a possibly relative href against a page URL. */
export function absPageUrl(href: string, pageUrl: string): string {
  try {
    return new URL(href, pageUrl).toString();
  } catch {
    return href;
  }
}

/** Strip HTML tags and collapse whitespace. */
export function stripHtmlText(raw: string): string {
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Dedupe list entries by id while preserving order. */
export function dedupeEntries(entries: VideoListEntry[]): VideoListEntry[] {
  const seen = new Set<string>();
  const out: VideoListEntry[] = [];
  for (const e of entries) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}

export function parseYouPornWatchEntries(html: string, pageUrl: string): VideoListEntry[] {
  const entries: VideoListEntry[] = [];

  for (const m of html.matchAll(
    /<a\b[^>]*\bhref=["'](?<href>\/watch\/(?<id>\d+)\/?[^"']*)["'][^>]*class=["'][^"']*video-title-text[^"']*["'][^>]*>(?<title>[\s\S]*?)<\/a>/gi,
  )) {
    const id = m.groups?.id;
    const href = m.groups?.href;
    if (!id || !href) continue;
    entries.push({
      id,
      url: absPageUrl(href, pageUrl),
      title: stripHtmlText(m.groups?.title || "") || null,
    });
  }

  if (!entries.length) {
    for (const m of html.matchAll(/href=["'](?<href>\/watch\/(?<id>\d+)\/?)["']/gi)) {
      const id = m.groups?.id;
      const href = m.groups?.href;
      if (!id || !href) continue;
      entries.push({ id, url: absPageUrl(href, pageUrl) });
    }
  }

  return dedupeEntries(entries);
}

export function parseYouPornNextPage(html: string, pageUrl: string): string | null {
  const current = new URL(pageUrl);
  const nextInNav = html.match(
    /<a\b[^>]*class=["'][^"']*pagination[^"']*["'][^>]*\bhref=["'](?<href>[^"']+)["']/gi,
  );
  if (nextInNav) {
    const pageNum = Number(current.searchParams.get("page") || "1");
    for (const m of html.matchAll(
      /<a\b[^>]*class=["'][^"']*pagination[^"']*["'][^>]*\bhref=["'](?<href>[^"']+)["']/gi,
    )) {
      const href = m.groups?.href;
      if (!href) continue;
      const abs = absPageUrl(href, pageUrl);
      const n = Number(new URL(abs).searchParams.get("page"));
      if (Number.isFinite(n) && n === pageNum + 1) return abs;
    }
  }
  const m = html.match(/<a\b[^>]*\bhref=["'](?<href>[^"']+)["'][^>]*>\s*Next/i);
  return m?.groups?.href ? absPageUrl(m.groups.href, pageUrl) : null;
}

export function parseYouJizzEntries(html: string, pageUrl: string): VideoListEntry[] {
  const entries: VideoListEntry[] = [];

  for (const m of html.matchAll(
    /<a\b[^>]*\bdata-video-id=["'](?<id>\d+)["'][^>]*\bhref=["'](?<href>\/videos\/[^"']+\.html)["']/gi,
  )) {
    const id = m.groups?.id;
    const href = m.groups?.href;
    if (!id || !href) continue;
    entries.push({ id, url: absPageUrl(href, pageUrl) });
  }

  for (const m of html.matchAll(
    /<div class="video-title">\s*<a href=['"](?<href>\/videos\/[^'"]+\.html)['"][^>]*>(?<title>[^<]+)/gi,
  )) {
    const href = m.groups?.href;
    if (!href) continue;
    const id = href.match(/-(\d+)\.html$/)?.[1];
    if (!id) continue;
    entries.push({
      id,
      url: absPageUrl(href, pageUrl),
      title: stripHtmlText(m.groups?.title || "") || null,
      display_id: href.match(/\/videos\/(.+)-\d+\.html$/)?.[1] || null,
    });
  }

  return dedupeEntries(entries);
}

export function parseYouJizzNextPage(html: string, pageUrl: string): string | null {
  const m = html.match(/<a\b[^>]*class=["']pagination-next["'][^>]*\bhref=["'](?<href>[^"']+)["']/i);
  return m?.groups?.href ? absPageUrl(m.groups.href, pageUrl) : null;
}
