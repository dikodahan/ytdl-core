"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDiscoverKalturaOttBody = parseDiscoverKalturaOttBody;
exports.runDiscoverKalturaOtt = runDiscoverKalturaOtt;
const youtube_dl_1 = require("../core/youtube-dl");
const discover_1 = require("../extractor/kaltura-ott/discover");
function parseDiscoverKalturaOttBody(raw) {
    const data = JSON.parse(raw || "{}");
    const applicationName = (typeof data.applicationName === "string" && data.applicationName.trim()) ||
        (typeof data.app === "string" && data.app.trim()) ||
        (typeof data.packageName === "string" && data.packageName.trim()) ||
        // Backward-compat: older clients sent website URL in `url`.
        (typeof data.url === "string" && data.url.trim()) ||
        "";
    if (!applicationName) {
        throw new Error("applicationName is required (Android app FQDN, e.g. com.cellcom.cellcomtv)");
    }
    return {
        applicationName,
        deepScan: data.deepScan === true ? true : data.deepScan === false ? false : undefined,
        deepScanLimit: typeof data.deepScanLimit === "number" && data.deepScanLimit > 0
            ? Math.min(Math.floor(data.deepScanLimit), 500)
            : undefined,
        proxy: typeof data.proxy === "string" && data.proxy ? data.proxy : undefined,
        impersonate: data.impersonate === false || data.impersonate == null || data.impersonate === ""
            ? undefined
            : data.impersonate,
        cloudflareBypass: data.cloudflareBypass === true,
    };
}
async function runDiscoverKalturaOtt(parsed) {
    const started = Date.now();
    const ydl = new youtube_dl_1.YoutubeDL({
        quiet: true,
        proxy: parsed.proxy,
        impersonate: parsed.impersonate,
        cloudflareBypass: parsed.cloudflareBypass,
    });
    try {
        const result = await (0, discover_1.discoverKalturaOttPartner)(ydl.request, parsed.applicationName, {
            deepScan: parsed.deepScan,
            deepScanLimit: parsed.deepScanLimit,
        });
        return {
            status: 200,
            body: {
                ...result,
                elapsedMs: Date.now() - started,
            },
        };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            status: 500,
            body: { ok: false, error: message, elapsedMs: Date.now() - started },
        };
    }
    finally {
        await ydl.close?.().catch(() => undefined);
    }
}
//# sourceMappingURL=discover.js.map