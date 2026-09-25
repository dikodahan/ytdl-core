"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SIGNED_HLS_URL = exports.CATEGORY_PAGE_URL = exports.CHANNEL_PAGE_URL = exports.LNN_RENEW_HEADERS = exports.LNN_STREAM_HEADERS = exports.LNN_REQUEST_HEADERS = exports.LNN_CHANNEL_SECTIONS = exports.LNN_CATEGORIES = exports.LNN_HOME_URL = exports.LNN_ORIGIN = void 0;
exports.lnnCategoryUrl = lnnCategoryUrl;
exports.lnnChannelPageUrl = lnnChannelPageUrl;
exports.listLnnCategories = listLnnCategories;
exports.unescapeJsString = unescapeJsString;
exports.parseChannelPageUrl = parseChannelPageUrl;
exports.parseCategoryPageUrl = parseCategoryPageUrl;
exports.parseLnnPseudoId = parseLnnPseudoId;
exports.extractSignedStreamUrl = extractSignedStreamUrl;
exports.parseChannelMeta = parseChannelMeta;
exports.parseCategoryChannelsHtml = parseCategoryChannelsHtml;
exports.categoryArchivePageUrls = categoryArchivePageUrls;
exports.discoverLnnCategoryChannels = discoverLnnCategoryChannels;
exports.discoverAllLnnChannels = discoverAllLnnChannels;
exports.resolveLnnChannel = resolveLnnChannel;
exports.lnnRenewUrl = lnnRenewUrl;
exports.parseLnnRenewResponse = parseLnnRenewResponse;
exports.renewLnnStreamUrl = renewLnnStreamUrl;
exports.extractLnnStreamFromPage = extractLnnStreamFromPage;
exports.LNN_ORIGIN = "https://www.livenewsnow.com";
exports.LNN_HOME_URL = `${exports.LNN_ORIGIN}/`;
exports.LNN_CATEGORIES = ["american", "business"];
/** Channel pages live under these path prefixes. */
exports.LNN_CHANNEL_SECTIONS = ["american", "business", "featured"];
exports.LNN_REQUEST_HEADERS = {
    Accept: "text/html,application/xhtml+xml",
    Referer: `${exports.LNN_ORIGIN}/`,
    Origin: exports.LNN_ORIGIN,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
};
exports.LNN_STREAM_HEADERS = {
    Referer: `${exports.LNN_ORIGIN}/`,
    Origin: exports.LNN_ORIGIN,
    Accept: "*/*",
};
/** Headers for `?renew=1` token mint (JSON). */
exports.LNN_RENEW_HEADERS = {
    ...exports.LNN_REQUEST_HEADERS,
    Accept: "application/json,text/plain,*/*",
    "X-Requested-With": "XMLHttpRequest",
};
const CATEGORY_TITLES = {
    american: "American",
    business: "Business",
};
/** Match channel HTML pages: `/american/cnbc.html`, `/featured/foxnews`. */
exports.CHANNEL_PAGE_URL = /^https?:\/\/(?:www\.)?livenewsnow\.com\/(?<section>american|business|featured)\/(?<slug>[a-z0-9-]+)(?:\.html)?\/?(?:[?#]|$)/i;
/** Category listing pages. */
exports.CATEGORY_PAGE_URL = /^https?:\/\/(?:www\.)?livenewsnow\.com\/category\/(?<id>american|business)\/?(?:[?#]|$)/i;
/** Signed HLS on livenewsplay(er).com (token/expires/sig or sec-/newz- params). */
exports.SIGNED_HLS_URL = /^https?:\/\/(?:[\w.-]+\.)?livenewsplay(?:er)?\.com(?::\d+)?\/[^\s]+\.m3u8(?:\?[^\s]*)?$/i;
function lnnCategoryUrl(id) {
    return `${exports.LNN_ORIGIN}/category/${id}`;
}
function lnnChannelPageUrl(section, slug) {
    return `${exports.LNN_ORIGIN}/${section}/${slug}.html`;
}
function listLnnCategories() {
    return exports.LNN_CATEGORIES.map(id => ({
        id,
        title: CATEGORY_TITLES[id],
        url: lnnCategoryUrl(id),
    }));
}
function absUrl(pathOrUrl, base) {
    try {
        return new URL(pathOrUrl, base).toString();
    }
    catch {
        return pathOrUrl;
    }
}
function decodeHtml(s) {
    return s
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}
/** Unescape JS/JSON string fragments (`\\u0026`, `\\/`, etc.). */
function unescapeJsString(raw) {
    try {
        return JSON.parse(`"${raw}"`);
    }
    catch {
        return raw
            .replace(/\\\//g, "/")
            .replace(/\\u0026/gi, "&")
            .replace(/\\u002f/gi, "/")
            .replace(/&amp;/g, "&");
    }
}
function normalizeChannelPageUrl(url) {
    try {
        const u = new URL(url);
        u.hash = "";
        u.search = "";
        let path = u.pathname.replace(/\/+$/, "");
        if (!/\.html$/i.test(path))
            path = `${path}.html`;
        u.pathname = path;
        return u.toString();
    }
    catch {
        return url;
    }
}
function parseChannelPageUrl(url) {
    const m = url.match(exports.CHANNEL_PAGE_URL);
    if (!m?.groups?.section || !m.groups.slug)
        return null;
    const section = m.groups.section.toLowerCase();
    const slug = m.groups.slug.toLowerCase();
    return { section, slug, pageUrl: lnnChannelPageUrl(section, slug) };
}
function parseCategoryPageUrl(url) {
    const m = url.match(exports.CATEGORY_PAGE_URL);
    const id = m?.groups?.id?.toLowerCase();
    if (id === "american" || id === "business")
        return id;
    return null;
}
/** Parse `livenewsnow:foxnews`, `livenewsnow:featured/foxnews`, `livenewsnow:american`. */
function parseLnnPseudoId(raw) {
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
            section: path.groups.section,
            slug: path.groups.slug,
        };
    }
    if (/^[a-z0-9-]+$/.test(key)) {
        return { kind: "channel", slug: key };
    }
    return null;
}
function displayIdFor(section, slug) {
    // Prefer bare slug; section/slug when needed for disambiguation by callers.
    return slug || `${section}/${slug}`;
}
/** Extract a playable signed HLS URL from a channel page body. */
function extractSignedStreamUrl(html) {
    // 1) Player config JSON: {"channel":"foxnews","streamUrl":"…\u0026…"}
    const streamUrlField = html.match(/["']streamUrl["']\s*:\s*["']([^"']+)["']/i);
    if (streamUrlField?.[1]) {
        const url = unescapeJsString(streamUrlField[1]).trim();
        if (exports.SIGNED_HLS_URL.test(url) || /\.m3u8(?:\?|$)/i.test(url))
            return url;
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
            if (/\.m3u8(?:\?|$)/i.test(url))
                return url;
        }
    }
    // 3) Any livenewsplay(er) m3u8 with query (allow escaped ampersands in source)
    const broad = html.match(/https?:\\?\/\\?\/(?:[\w.-]+\.)?livenewsplay(?:er)?\.com(?::\d+)?(?:\\?\/[^\s"'<>]+?)\.m3u8(?:\?|\\u0026|&amp;|&)[^\s"'<>]*/i);
    if (broad?.[0]) {
        const url = unescapeJsString(broad[0]).split(/["'\s]/)[0];
        if (/\.m3u8(?:\?|$)/i.test(url))
            return url;
    }
    // 4) Plain unescaped host URL
    const plain = html.match(/https:\/\/(?:[\w.-]+\.)?livenewsplay(?:er)?\.com(?::\d+)?\/[^\s"'<>]+\.m3u8\?[^\s"'<>]+/i);
    if (plain?.[0])
        return plain[0].replace(/&amp;/g, "&");
    // 5) Third-party HLS embedded via JWPlayer (e.g. CBSN) — still playable
    const anyM3u8 = html.match(/\bfile\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
    if (anyM3u8?.[1])
        return unescapeJsString(anyM3u8[1]).trim();
    return null;
}
function parseChannelMeta(html, fallbackTitle) {
    let channelKey = null;
    let configTitle = null;
    const channelField = html.match(/["']channel["']\s*:\s*["']([^"']+)["']/i);
    if (channelField?.[1])
        channelKey = channelField[1].trim().toLowerCase();
    const titleField = html.match(/["']title["']\s*:\s*["']([^"']+)["']/i);
    if (titleField?.[1])
        configTitle = decodeHtml(titleField[1].trim());
    const ogTitle = html.match(/property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1] ||
        html.match(/content=["']([^"']+)["']\s+property=["']og:title["']/i)?.[1] ||
        null;
    const docTitle = html.match(/<title[^>]*>\s*([^<]+?)\s*<\/title>/i)?.[1] || null;
    const thumbnail = html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1] ||
        html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i)?.[1] ||
        null;
    const title = configTitle ||
        (ogTitle ? decodeHtml(ogTitle) : null) ||
        (docTitle ? decodeHtml(docTitle.replace(/\s+/g, " ").trim()) : null) ||
        fallbackTitle;
    return { title, thumbnail, channelKey };
}
/** Parse channel cards from a category archive page. */
function parseCategoryChannelsHtml(html, categoryId, pageUrl = lnnCategoryUrl(categoryId)) {
    const byPage = new Map();
    // Theme mixes `<h3 class="entry-title">` grid cards and `<div class="entry-title">`
    // sidebar/module cards — Fox Business often only appears in the latter on /american.
    const entryRe = /<(?:h3|div)[^>]*class="[^"]*entry-title[^"]*"[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*(?:title="([^"]*)")?[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = entryRe.exec(html))) {
        const href = absUrl(m[1], pageUrl);
        const parsed = parseChannelPageUrl(href);
        if (!parsed)
            continue;
        const titleAttr = m[2] ? decodeHtml(m[2]) : "";
        const inner = decodeHtml(m[3].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
        const title = titleAttr || inner || parsed.slug;
        const page = normalizeChannelPageUrl(parsed.pageUrl);
        const existing = byPage.get(page);
        if (existing) {
            if (!existing.categoryIds.includes(categoryId))
                existing.categoryIds.push(categoryId);
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
/** Collect `/category/{id}/page/N` links from archive HTML (WordPress pagination). */
function categoryArchivePageUrls(html, categoryId) {
    const root = lnnCategoryUrl(categoryId);
    const pages = new Set([root]);
    const re = new RegExp(`${exports.LNN_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/category/${categoryId}/page/(\\d+)`, "gi");
    let m;
    while ((m = re.exec(html))) {
        const n = Number(m[1]);
        if (Number.isFinite(n) && n >= 2 && n <= 50) {
            pages.add(`${root}/page/${n}`);
        }
    }
    return [...pages].sort((a, b) => {
        const pageOf = (u) => {
            const mm = u.match(/\/page\/(\d+)\/?$/i);
            return mm ? Number(mm[1]) : 1;
        };
        return pageOf(a) - pageOf(b);
    });
}
async function discoverLnnCategoryChannels(request, categoryId) {
    const byPage = new Map();
    const rootUrl = lnnCategoryUrl(categoryId);
    const firstHtml = await request.text(rootUrl, { headers: { ...exports.LNN_REQUEST_HEADERS } });
    const pageUrls = categoryArchivePageUrls(firstHtml, categoryId);
    for (const pageUrl of pageUrls) {
        let html;
        try {
            html =
                pageUrl === rootUrl
                    ? firstHtml
                    : await request.text(pageUrl, { headers: { ...exports.LNN_REQUEST_HEADERS } });
        }
        catch {
            // Theme often emits stale `/page/N` links that 404 — skip and keep what we have.
            continue;
        }
        for (const ch of parseCategoryChannelsHtml(html, categoryId, pageUrl)) {
            const existing = byPage.get(ch.pageUrl);
            if (!existing) {
                byPage.set(ch.pageUrl, ch);
                continue;
            }
            for (const id of ch.categoryIds) {
                if (!existing.categoryIds.includes(id))
                    existing.categoryIds.push(id);
            }
        }
    }
    if (!byPage.size) {
        throw new Error(`livenewsnow: no channels found in category ${categoryId}`);
    }
    return [...byPage.values()];
}
async function discoverAllLnnChannels(request) {
    const byPage = new Map();
    for (const cat of exports.LNN_CATEGORIES) {
        const channels = await discoverLnnCategoryChannels(request, cat);
        for (const ch of channels) {
            const existing = byPage.get(ch.pageUrl);
            if (!existing) {
                byPage.set(ch.pageUrl, { ...ch, categoryIds: [...ch.categoryIds] });
                continue;
            }
            for (const id of ch.categoryIds) {
                if (!existing.categoryIds.includes(id))
                    existing.categoryIds.push(id);
            }
        }
    }
    return [...byPage.values()];
}
async function resolveLnnChannel(request, ref) {
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
        for (const section of exports.LNN_CHANNEL_SECTIONS) {
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
            }
            catch {
                /* try next */
            }
        }
        throw new Error(`livenewsnow: unknown channel ${ref.slug}`);
    }
    // Prefer featured / american when duplicates exist
    const prefer = ["featured", "american", "business"];
    matches.sort((a, b) => prefer.indexOf(a.section) - prefer.indexOf(b.section));
    return matches[0];
}
/** Build the on-page renew URL used by the Live News Now player (`?renew=1`). */
function lnnRenewUrl(pageUrl) {
    const u = new URL(pageUrl);
    u.searchParams.set("renew", "1");
    u.searchParams.set("_", String(Date.now()));
    return u.toString();
}
/** Parse `{"url":"…","expires_in":3600}` (or the same JSON embedded in HTML). */
function parseLnnRenewResponse(body) {
    const tryParse = (raw) => {
        try {
            const j = JSON.parse(raw);
            if (typeof j?.url !== "string" || !j.url)
                return null;
            const url = unescapeJsString(j.url).trim();
            if (!/\.m3u8(?:\?|$)/i.test(url))
                return null;
            const expiresIn = typeof j.expires_in === "number" && Number.isFinite(j.expires_in)
                ? j.expires_in
                : Number(j.expires_in);
            return {
                url,
                expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600,
            };
        }
        catch {
            return null;
        }
    };
    const trimmed = body.trim();
    const direct = tryParse(trimmed);
    if (direct)
        return direct;
    const start = body.indexOf('{"url"');
    if (start < 0)
        return null;
    // Flat renew payload — find the matching closing brace for this object.
    let depth = 0;
    for (let i = start; i < body.length; i++) {
        const ch = body[i];
        if (ch === "{")
            depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) {
                return tryParse(body.slice(start, i + 1));
            }
        }
    }
    return null;
}
/**
 * Mint a fresh signed HLS URL via the channel page's `?renew=1` endpoint.
 * Returns null when the page does not support renew (legacy JWPlayer embeds).
 */
async function renewLnnStreamUrl(request, pageUrl) {
    const renewUrl = lnnRenewUrl(pageUrl);
    try {
        const text = await request.text(renewUrl, { headers: { ...exports.LNN_RENEW_HEADERS } });
        const parsed = parseLnnRenewResponse(text);
        if (!parsed)
            return null;
        if (exports.SIGNED_HLS_URL.test(parsed.url) || /\.m3u8(?:\?|$)/i.test(parsed.url)) {
            return parsed.url;
        }
    }
    catch {
        /* fall back to HTML scrape */
    }
    return null;
}
async function extractLnnStreamFromPage(request, pageUrl) {
    const parsed = parseChannelPageUrl(pageUrl);
    const normalized = parsed?.pageUrl || normalizeChannelPageUrl(pageUrl);
    // Prefer `?renew=1` — embeds in HTML are short-lived (~1h) and go stale while
    // the page HTML stays cached. Renew mints a new token every call.
    const renewed = await renewLnnStreamUrl(request, normalized);
    const bust = new URL(normalized);
    bust.searchParams.set("_", String(Date.now()));
    const html = await request.text(bust.toString(), {
        headers: { ...exports.LNN_REQUEST_HEADERS },
    });
    const streamUrl = renewed || extractSignedStreamUrl(html);
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
//# sourceMappingURL=client.js.map