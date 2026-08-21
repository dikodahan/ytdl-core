"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.absPageUrl = absPageUrl;
exports.stripHtmlText = stripHtmlText;
exports.dedupeEntries = dedupeEntries;
exports.parseYouPornWatchEntries = parseYouPornWatchEntries;
exports.parseYouPornNextPage = parseYouPornNextPage;
exports.parseYouPornCategories = parseYouPornCategories;
exports.parseYouJizzEntries = parseYouJizzEntries;
exports.parseYouJizzNextPage = parseYouJizzNextPage;
exports.parseXnxxEntries = parseXnxxEntries;
exports.parseXnxxNextPage = parseXnxxNextPage;
exports.parseXnxxCategories = parseXnxxCategories;
exports.parseXvideosCategories = parseXvideosCategories;
exports.parseXvideosEntries = parseXvideosEntries;
exports.parseXvideosNextPage = parseXvideosNextPage;
/** Resolve a possibly relative href against a page URL. */
function absPageUrl(href, pageUrl) {
    try {
        return new URL(href, pageUrl).toString();
    }
    catch {
        return href;
    }
}
/** Strip HTML tags and collapse whitespace. */
function stripHtmlText(raw) {
    return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
/** Dedupe list entries by id while preserving order. */
function dedupeEntries(entries) {
    const seen = new Set();
    const out = [];
    for (const e of entries) {
        if (seen.has(e.id))
            continue;
        seen.add(e.id);
        out.push(e);
    }
    return out;
}
function absCdnUrl(raw) {
    if (!raw)
        return null;
    const url = raw.trim().replace(/\\\//g, "/");
    if (!url || url.includes("lightbox-blank.gif"))
        return null;
    if (url.startsWith("//"))
        return `https:${url}`;
    return url;
}
function extractBalancedJson(html, openIndex) {
    const open = html[openIndex];
    const close = open === "{" ? "}" : open === "[" ? "]" : null;
    if (!close)
        return null;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = openIndex; i < html.length; i++) {
        const ch = html[i];
        if (inStr) {
            if (esc)
                esc = false;
            else if (ch === "\\")
                esc = true;
            else if (ch === '"')
                inStr = false;
            continue;
        }
        if (ch === '"') {
            inStr = true;
            continue;
        }
        if (ch === open)
            depth++;
        else if (ch === close) {
            depth--;
            if (depth === 0) {
                try {
                    return JSON.parse(html.slice(openIndex, i + 1));
                }
                catch {
                    return null;
                }
            }
        }
    }
    return null;
}
function pickListingThumbnail(block) {
    const mzl = block.match(/\bdata-mzl=["'](?<url>[^"']+)["']/i)?.groups?.url;
    const src = block.match(/\bdata-src=["'](?<url>[^"']+)["']/i)?.groups?.url;
    const sfw = block.match(/\bdata-sfwthumb=["'](?<url>[^"']+)["']/i)?.groups?.url;
    return absCdnUrl(mzl || src || sfw);
}
function parseYouPornWatchEntries(html, pageUrl) {
    const entries = [];
    for (const m of html.matchAll(/<a\b[^>]*\bhref=["'](?<href>\/watch\/(?<id>\d+)\/?[^"']*)["'][^>]*class=["'][^"']*video-title-text[^"']*["'][^>]*>(?<title>[\s\S]*?)<\/a>/gi)) {
        const id = m.groups?.id;
        const href = m.groups?.href;
        if (!id || !href)
            continue;
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
            if (!id || !href)
                continue;
            entries.push({ id, url: absPageUrl(href, pageUrl) });
        }
    }
    return dedupeEntries(entries);
}
function parseYouPornNextPage(html, pageUrl) {
    const relNext = html.match(/<link\b[^>]*\brel=["']next["'][^>]*\bhref=["'](?<href>[^"']+)["']/i);
    if (relNext?.groups?.href) {
        return absPageUrl(relNext.groups.href, pageUrl);
    }
    const current = new URL(pageUrl);
    const nextInNav = html.match(/<a\b[^>]*class=["'][^"']*pagination[^"']*["'][^>]*\bhref=["'](?<href>[^"']+)["']/gi);
    if (nextInNav) {
        const pageNum = Number(current.searchParams.get("page") || "1");
        for (const m of html.matchAll(/<a\b[^>]*class=["'][^"']*pagination[^"']*["'][^>]*\bhref=["'](?<href>[^"']+)["']/gi)) {
            const href = m.groups?.href;
            if (!href)
                continue;
            const abs = absPageUrl(href, pageUrl);
            const n = Number(new URL(abs).searchParams.get("page"));
            if (Number.isFinite(n) && n === pageNum + 1)
                return abs;
        }
    }
    const m = html.match(/<a\b[^>]*\bhref=["'](?<href>[^"']+)["'][^>]*>\s*Next/i);
    return m?.groups?.href ? absPageUrl(m.groups.href, pageUrl) : null;
}
function decodeHtmlEntities(text) {
    return text
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&apos;/g, "'");
}
function categorySlugFromHref(href, kind) {
    const m = href.match(kind === "porntags" ? /^\/porntags\/([^/?#]+)/i : /^\/category\/([^/?#]+)/i);
    return m?.[1]?.replace(/\/+$/g, "") || null;
}
function dedupeCategoryEntries(entries) {
    const byId = new Map();
    for (const entry of entries) {
        const existing = byId.get(entry.id);
        if (!existing) {
            byId.set(entry.id, entry);
            continue;
        }
        if (entry.url.includes("/porntags/") && !existing.url.includes("/porntags/")) {
            byId.set(entry.id, entry);
        }
    }
    return [...byId.values()];
}
/** Parse browse categories/tags from the YouPorn homepage or legacy index HTML. */
function parseYouPornCategories(html, pageUrl) {
    const entries = [];
    for (const m of html.matchAll(/<a\b[^>]*\bhref=["'](?<href>\/category\/[^"'#?]+)\/?["'][^>]*class=["'][^"']*categoryBox[^"']*["'][\s\S]*?alt=["'](?<title>[^"']+)["']/gi)) {
        const href = m.groups?.href;
        const title = m.groups?.title;
        if (!href)
            continue;
        const slug = categorySlugFromHref(href, "category");
        if (!slug)
            continue;
        entries.push({
            id: slug,
            title: title ? decodeHtmlEntities(title) : slug,
            url: absPageUrl(href.endsWith("/") ? href : `${href}/`, pageUrl),
            display_id: slug,
        });
    }
    for (const m of html.matchAll(/<a\b(?=[^>]*\bclass=["'][^"']*(?:bubble-porntag|bubble-button)[^"']*["'])[^>]*\bhref=["'](?<href>\/porntags\/[^"'#?]+)\/?["'][^>]*>(?<title>[^<]+)/gi)) {
        const href = m.groups?.href;
        const title = m.groups?.title?.trim();
        if (!href)
            continue;
        const slug = categorySlugFromHref(href, "porntags");
        if (!slug)
            continue;
        entries.push({
            id: slug,
            title: title ? decodeHtmlEntities(title) : slug,
            url: absPageUrl(href.endsWith("/") ? href : `${href}/`, pageUrl),
            display_id: slug,
        });
    }
    for (const m of html.matchAll(/<a\b(?=[^>]*(?:class=["'][^"']*(?:menu_elem_text|top-trending-cat)[^"']*["']|data-menu-link-name))[^>]*\bhref=["'](?<href>\/category\/[^"'#?]+)\/?["']/gi)) {
        const href = m.groups?.href;
        if (!href)
            continue;
        const slug = categorySlugFromHref(href, "category");
        if (!slug)
            continue;
        entries.push({
            id: slug,
            title: slug,
            url: absPageUrl(href.endsWith("/") ? href : `${href}/`, pageUrl),
            display_id: slug,
        });
    }
    return dedupeCategoryEntries(entries);
}
function parseYouJizzEntries(html, pageUrl) {
    const entries = [];
    for (const m of html.matchAll(/<a\b[^>]*\bdata-video-id=["'](?<id>\d+)["'][^>]*\bhref=["'](?<href>\/videos\/[^"']+\.html)["']/gi)) {
        const id = m.groups?.id;
        const href = m.groups?.href;
        if (!id || !href)
            continue;
        entries.push({ id, url: absPageUrl(href, pageUrl) });
    }
    for (const m of html.matchAll(/<div class="video-title">\s*<a href=['"](?<href>\/videos\/[^'"]+\.html)['"][^>]*>(?<title>[^<]+)/gi)) {
        const href = m.groups?.href;
        if (!href)
            continue;
        const id = href.match(/-(\d+)\.html$/)?.[1];
        if (!id)
            continue;
        entries.push({
            id,
            url: absPageUrl(href, pageUrl),
            title: stripHtmlText(m.groups?.title || "") || null,
            display_id: href.match(/\/videos\/(.+)-\d+\.html$/)?.[1] || null,
        });
    }
    return dedupeEntries(entries);
}
function parseYouJizzNextPage(html, pageUrl) {
    const m = html.match(/<a\b[^>]*class=["']pagination-next["'][^>]*\bhref=["'](?<href>[^"']+)["']/i);
    return m?.groups?.href ? absPageUrl(m.groups.href, pageUrl) : null;
}
function parseXnxxEntries(html, pageUrl) {
    const byId = new Map();
    for (const block of html.split(/(?=<div[^>]*\bid=["']video_[a-z0-9]+["'])/i)) {
        const id = block.match(/\bid=["']video_(?<id>[a-z0-9]+)["']/i)?.groups?.id;
        if (!id)
            continue;
        const href = block.match(/\bhref=["'](?<href>\/video-[a-z0-9]+\/[^"']*)["']/i)?.groups?.href ||
            `/video-${id}/`;
        const title = block.match(/\btitle=["'](?<title>[^"']+)["']/i)?.groups?.title ||
            block.match(/<a[^>]+href=["']\/video-[^"']+["'][^>]*>(?<title>[^<]+)/i)?.groups?.title;
        byId.set(id, {
            id,
            url: absPageUrl(href, pageUrl),
            title: title ? decodeHtmlEntities(title) : null,
            thumbnail: pickListingThumbnail(block),
        });
    }
    if (!byId.size) {
        for (const m of html.matchAll(/<a\b[^>]*\bhref=["'](?<href>\/video-(?<id>[a-z0-9]+)\/[^"']*)["'][^>]*\btitle=["'](?<title>[^"']+)["']/gi)) {
            const id = m.groups?.id;
            const href = m.groups?.href;
            if (!id || !href || byId.has(id))
                continue;
            byId.set(id, {
                id,
                url: absPageUrl(href, pageUrl),
                title: decodeHtmlEntities(m.groups?.title || "") || null,
            });
        }
    }
    return dedupeEntries([...byId.values()]);
}
function parseXnxxNextPage(html, pageUrl) {
    const m = html.match(/<a\b[^>]*class=["'][^"']*no-page next[^"']*["'][^>]*\bhref=["'](?<href>[^"'#]+)["']/i);
    return m?.groups?.href ? absPageUrl(m.groups.href, pageUrl) : null;
}
function xnxxCategorySlug(href) {
    const search = href.match(/^\/search\/([^/?#]+)/i);
    if (search?.[1])
        return decodeURIComponent(search[1].replace(/\+/g, " "));
    const path = href.match(/^\/([^/?#]+)/i);
    return path?.[1] || null;
}
function normalizeXnxxBrowsePath(href) {
    return href.split("?")[0].replace(/\/+$/, "") || "/";
}
function parseXnxxConfCategories(html) {
    const marker = html.match(/window\.xv\.conf\s*=\s*(\{)/);
    if (marker?.index == null)
        return [];
    const brace = html.indexOf("{", marker.index);
    const conf = extractBalancedJson(html, brace);
    return conf?.dyn?.categories || conf?.categories || [];
}
function parseXnxxThumbBlockList(html) {
    const marker = html.match(/write_thumb_block_list\s*\(\s*(\[)/);
    if (marker?.index == null)
        return [];
    const start = html.indexOf("[", marker.index);
    const parsed = extractBalancedJson(html, start);
    return Array.isArray(parsed) ? parsed : [];
}
/** Parse browse categories/tags from XNXX homepage config or tag index pages. */
function parseXnxxCategories(html, pageUrl) {
    const byId = new Map();
    for (const item of parseXnxxThumbBlockList(html)) {
        if (!item.u || !item.i)
            continue;
        const href = normalizeXnxxBrowsePath(item.u);
        const slug = xnxxCategorySlug(href);
        const id = item.id != null ? String(item.id) : slug?.replace(/\s+/g, "_").toLowerCase();
        if (!id)
            continue;
        const title = item.t || item.tf;
        byId.set(id, {
            id,
            title: title ? decodeHtmlEntities(title) : slug || id,
            url: absPageUrl(href.endsWith("/") ? href : `${href}/`, pageUrl),
            display_id: slug || id,
            thumbnail: absCdnUrl(item.i),
        });
    }
    for (const cat of parseXnxxConfCategories(html)) {
        if (!cat.url || !cat.label)
            continue;
        const href = normalizeXnxxBrowsePath(cat.url);
        const slug = xnxxCategorySlug(href);
        const id = cat.cat_id != null ? String(cat.cat_id) : slug;
        if (!id)
            continue;
        const existing = byId.get(id);
        byId.set(id, {
            id,
            title: decodeHtmlEntities(cat.label),
            url: absPageUrl(href.endsWith("/") ? href : `${href}/`, pageUrl),
            display_id: slug || id,
            thumbnail: existing?.thumbnail ?? null,
        });
    }
    for (const m of html.matchAll(/<a\b[^>]*\bhref=["'](?<href>\/search\/[^"'#?]+)["'][^>]*>(?<title>[^<]+)/gi)) {
        const href = m.groups?.href;
        const title = m.groups?.title?.trim();
        if (!href)
            continue;
        const slug = xnxxCategorySlug(href);
        if (!slug)
            continue;
        const id = slug.replace(/\s+/g, "_").toLowerCase();
        if (byId.has(id))
            continue;
        byId.set(id, {
            id,
            title: title ? decodeHtmlEntities(title) : slug,
            url: absPageUrl(href.endsWith("/") ? href : `${href}/`, pageUrl),
            display_id: slug,
        });
    }
    return [...byId.values()];
}
/** Parse XVideos category menu links (`/c/Amateur-65`). */
function parseXvideosCategories(html, pageUrl) {
    const byId = new Map();
    for (const m of html.matchAll(/<a\b[^>]*\bhref=["'](?<href>\/c\/(?<slug>[A-Za-z0-9_]+)-(?<num>\d+))\/?["'][^>]*>\s*(?<title>[^<]+)/gi)) {
        const href = m.groups?.href;
        const num = m.groups?.num;
        const slug = m.groups?.slug;
        if (!href || !num || !slug)
            continue;
        const rawTitle = (m.groups?.title || "").trim();
        const title = decodeHtmlEntities(rawTitle || slug.replace(/_/g, " "));
        const url = absPageUrl(href, pageUrl);
        const existing = byId.get(num);
        if (existing) {
            // Prefer human labels without underscores when both appear.
            const prev = existing.title || "";
            if (!/_/.test(prev) || /_/.test(title))
                continue;
        }
        byId.set(num, {
            id: num,
            title,
            url,
            display_id: `${slug}-${num}`,
        });
    }
    return [...byId.values()];
}
/** Parse video tiles from an XVideos listing / category page. */
function parseXvideosEntries(html, pageUrl) {
    const byId = new Map();
    for (const block of html.split(/(?=<div[^>]*(?:\bid=["']video_[a-z0-9]+["']|[^>]*\bdata-eid=["'][a-z0-9]+["']))/i)) {
        const id = block.match(/\bdata-eid=["'](?<id>[a-z0-9]+)["']/i)?.groups?.id ||
            block.match(/\bid=["']video_(?<id>[a-z0-9]+)["']/i)?.groups?.id;
        if (!id)
            continue;
        const href = block.match(/\bhref=["'](?<href>\/video\.[a-z0-9]+\/[^"']*)["']/i)?.groups?.href ||
            block.match(/\bhref=["'](?<href>\/video\d+\/[^"']*)["']/i)?.groups?.href;
        if (!href)
            continue;
        const title = block.match(/<p\s+class=["']title["'][\s\S]*?\btitle=["'](?<title>[^"']+)["']/i)?.groups
            ?.title || block.match(/\btitle=["'](?<title>[^"']+)["']/i)?.groups?.title;
        byId.set(id, {
            id,
            url: absPageUrl(href, pageUrl),
            title: title ? decodeHtmlEntities(title) : null,
            thumbnail: pickListingThumbnail(block),
        });
    }
    if (!byId.size) {
        for (const m of html.matchAll(/<a\b[^>]*\bhref=["'](?<href>\/video\.(?<id>[a-z0-9]+)\/[^"']*)["'][^>]*\btitle=["'](?<title>[^"']+)["']/gi)) {
            const id = m.groups?.id;
            const href = m.groups?.href;
            if (!id || !href || byId.has(id))
                continue;
            byId.set(id, {
                id,
                url: absPageUrl(href, pageUrl),
                title: decodeHtmlEntities(m.groups?.title || "") || null,
            });
        }
    }
    return dedupeEntries([...byId.values()]);
}
function parseXvideosNextPage(html, pageUrl) {
    const m = html.match(/<a\b[^>]*class=["'][^"']*next-page[^"']*["'][^>]*\bhref=["'](?<href>[^"'#]+)["']/i) ||
        html.match(/<a\b[^>]*\bhref=["'](?<href>[^"'#]+)["'][^>]*class=["'][^"']*next-page[^"']*["']/i);
    const href = m?.groups?.href?.trim();
    if (!href || href === "#")
        return null;
    return absPageUrl(href, pageUrl);
}
//# sourceMappingURL=page-links.js.map