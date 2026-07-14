"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractWebpageMedia = extractWebpageMedia;
const helpers_1 = require("./helpers");
function unescapeHtml(value) {
    return value
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
}
function absUrl(href, base) {
    try {
        return new URL(href, base).toString();
    }
    catch {
        return null;
    }
}
function pushUrl(formats, raw, base, formatId) {
    if (!raw)
        return;
    const url = absUrl(unescapeHtml(raw.trim()), base);
    if (!url || !/^https?:\/\//i.test(url))
        return;
    if (formats.some(f => f.url === url || f.manifest_url === url))
        return;
    if (/\.m3u8($|\?)/i.test(url) || /\/manifest(\.m3u8)?($|\?)/i.test(url)) {
        formats.push((0, helpers_1.hlsFormat)(url, formatId));
    }
    else if (/\.mpd($|\?)/i.test(url)) {
        formats.push({
            format_id: formatId,
            url,
            manifest_url: url,
            ext: "mp4",
            protocol: "http_dash_segments",
            isDashMPD: true,
            has_video: true,
            has_audio: true,
        });
    }
    else if (/\.(mp4|webm|m4a|mp3|aac|ogg|mov|mkv)($|\?)/i.test(url) || /mime_type=video/i.test(url)) {
        formats.push((0, helpers_1.progressiveFormat)(url, { format_id: formatId }));
    }
    else if (/googlevideo|videoplayback|cdn\.|media\.|stream/i.test(url) && !/\.(js|css|png|jpe?g|gif|svg|webp)($|\?)/i.test(url)) {
        formats.push((0, helpers_1.progressiveFormat)(url, { format_id: formatId }));
    }
}
/** Best-effort scrape of playable media URLs from an HTML page (OG / JSON-LD / <video>). */
async function extractWebpageMedia(request, pageUrl, extractorName) {
    const html = await request.text(pageUrl, {
        headers: { Accept: "text/html,application/xhtml+xml" },
    });
    const formats = [];
    const ogVideo = html.match(/property=["']og:video(?::(?:secure_url|url))?["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
        html.match(/content=["']([^"']+)["'][^>]*property=["']og:video(?::(?:secure_url|url))?["']/i)?.[1];
    pushUrl(formats, ogVideo, pageUrl, "og-video");
    const twitterPlayer = html.match(/name=["']twitter:player:stream["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
        html.match(/content=["']([^"']+)["'][^>]*name=["']twitter:player:stream["']/i)?.[1];
    pushUrl(formats, twitterPlayer, pageUrl, "twitter-stream");
    for (const m of html.matchAll(/<video[^>]+src=["']([^"']+)["']/gi)) {
        pushUrl(formats, m[1], pageUrl, "html5-video");
    }
    for (const m of html.matchAll(/<source[^>]+src=["']([^"']+)["']/gi)) {
        pushUrl(formats, m[1], pageUrl, "html5-source");
    }
    for (const m of html.matchAll(/<audio[^>]+src=["']([^"']+)["']/gi)) {
        pushUrl(formats, m[1], pageUrl, "html5-audio");
    }
    for (const m of html.matchAll(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi)) {
        pushUrl(formats, m[0], pageUrl, "m3u8");
    }
    for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        const data = (0, helpers_1.tryParseJson)(m[1].trim());
        const nodes = Array.isArray(data) ? data : data ? [data] : [];
        for (const node of nodes) {
            walkJsonLd(node, pageUrl, formats);
        }
    }
    const title = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
        html.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i)?.[1] ||
        html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ||
        pageUrl;
    const thumbnail = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
        html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1];
    const id = html.match(/property=["']og:url["'][^>]*content=["']([^"']+)["']/i)?.[1]?.split("/").filter(Boolean).pop() ||
        new URL(pageUrl).pathname.split("/").filter(Boolean).pop() ||
        extractorName;
    if (!formats.length) {
        throw new Error(`${extractorName}: no playable media found on page (site may need a dedicated extractor or cookies)`);
    }
    return (0, helpers_1.baseInfo)(extractorName, pageUrl, {
        id: decodeURIComponent(id),
        title: unescapeHtml(title),
        thumbnail: thumbnail ? absUrl(thumbnail, pageUrl) || thumbnail : undefined,
        formats,
    });
}
function walkJsonLd(node, pageUrl, formats) {
    if (!node || typeof node !== "object")
        return;
    if (Array.isArray(node)) {
        for (const n of node)
            walkJsonLd(n, pageUrl, formats);
        return;
    }
    const obj = node;
    const type = String(obj["@type"] || "");
    if (/VideoObject|AudioObject|MediaObject/i.test(type)) {
        const content = (typeof obj.contentUrl === "string" && obj.contentUrl) ||
            (typeof obj.embedUrl === "string" && obj.embedUrl) ||
            (typeof obj.url === "string" && obj.url) ||
            null;
        pushUrl(formats, content, pageUrl, "jsonld");
    }
    if (obj["@graph"])
        walkJsonLd(obj["@graph"], pageUrl, formats);
    for (const v of Object.values(obj)) {
        if (v && typeof v === "object")
            walkJsonLd(v, pageUrl, formats);
    }
}
//# sourceMappingURL=webpage-media.js.map