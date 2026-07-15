"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseListBody = parseListBody;
exports.runList = runList;
exports.listMetaForDocs = listMetaForDocs;
const youtube_dl_1 = require("../core/youtube-dl");
const registry_1 = require("../core/registry");
const KNOWN_KEYS = new Set([
    "url",
    "site",
    "service",
    "page",
    "limit",
    "proxy",
    "impersonate",
    "cloudflareBypass",
    "forceImpersonate",
    "quiet",
    "headers",
]);
function parseListBody(raw) {
    const data = JSON.parse(raw || "{}");
    const site = (typeof data.site === "string" && data.site) ||
        (typeof data.service === "string" && data.service) ||
        undefined;
    const pageRaw = data.page;
    const limitRaw = data.limit;
    const page = typeof pageRaw === "number" && Number.isFinite(pageRaw)
        ? pageRaw
        : typeof pageRaw === "string" && pageRaw.trim()
            ? Number(pageRaw)
            : undefined;
    const limit = typeof limitRaw === "number" && Number.isFinite(limitRaw)
        ? limitRaw
        : typeof limitRaw === "string" && limitRaw.trim()
            ? Number(limitRaw)
            : undefined;
    const impersonateRaw = data.impersonate;
    const impersonate = impersonateRaw === false || impersonateRaw === "" || impersonateRaw == null
        ? undefined
        : impersonateRaw;
    return {
        url: typeof data.url === "string" ? data.url : undefined,
        site,
        service: site,
        page: page && page > 0 ? Math.floor(page) : undefined,
        limit: limit && limit > 0 ? Math.floor(limit) : undefined,
        proxy: typeof data.proxy === "string" && data.proxy ? data.proxy : undefined,
        impersonate,
        cloudflareBypass: data.cloudflareBypass === true,
        forceImpersonate: data.forceImpersonate === true,
        quiet: true,
        headers: data.headers && typeof data.headers === "object"
            ? data.headers
            : undefined,
    };
}
async function runList(parsed) {
    const target = parsed.url?.trim();
    if (!target) {
        return { status: 400, body: { error: "url is required" } };
    }
    const site = parsed.site || parsed.service;
    if (site && !(0, registry_1.findExtractorByName)(site)) {
        return { status: 400, body: { error: `Unknown site: ${site}` } };
    }
    try {
        if (site)
            (0, registry_1.resolveListExtractor)(target, site);
        else if (!(0, registry_1.resolveListExtractor)(target)) {
            return {
                status: 400,
                body: {
                    error: "No list-capable extractor for this URL",
                    hint: "Use a browse/category listing URL and/or force service to youporn or youjizz.",
                },
            };
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { status: 400, body: { error: message } };
    }
    const started = Date.now();
    const ydl = new youtube_dl_1.YoutubeDL({ ...parsed, site, service: site });
    try {
        const result = await ydl.listVideos(target, { page: parsed.page, limit: parsed.limit });
        return {
            status: 200,
            body: {
                ok: true,
                elapsedMs: Date.now() - started,
                extractor: result.extractor,
                webpage_url: result.webpage_url,
                playlist_id: result.playlist_id,
                playlist_title: result.playlist_title,
                page: result.page,
                count: result.entries.length,
                next_page_url: result.next_page_url ?? null,
                entries: result.entries,
            },
        };
    }
    finally {
        await ydl.close();
    }
}
function listMetaForDocs() {
    return { method: "POST", path: "/api/v1/list", auth: true };
}
//# sourceMappingURL=list.js.map