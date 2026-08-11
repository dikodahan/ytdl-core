"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MakoIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const channels_1 = require("./channels");
const discover_1 = require("./discover");
const token_1 = require("./token");
/** Pseudo-URL: `mako:k12`, `mako:channels`, `mako:channels:free`. */
const PSEUDO_URL = /^mako:(?:(?<kind>channels)(?::(?<group>live|free|extra))?|(?<id>[a-z0-9-]+))$/i;
/** Direct CDN playlist on mako-streaming.akamaized.net. */
const CDN_URL = /^https?:\/\/mako-streaming\.akamaized\.net\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?$/i;
class MakoIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "mako";
    static IE_DESC = "Mako / Keshet — live & free linear TV (Akamai token)";
    static _VALID_URL = /^(?:mako:[a-z0-9:-]+|https?:\/\/mako-streaming\.akamaized\.net\/.+\.m3u8(?:\?.*)?)$/i;
    static getInfo() {
        return {
            name: this.IE_NAME,
            description: `${this.IE_DESC} — mass.mako.co.il entitlement + HLS`,
            validUrl: String(this._VALID_URL),
            options: [],
            notes: "Use `mako:channels` to list IDs discovered from mako.co.il (MediaBox catalog only if site discovery fails), or `mako:k12` / a `mako-streaming.akamaized.net` m3u8 URL to extract. Streams require a short-lived Akamai `hdnea` ticket.",
            listSupported: true,
        };
    }
    static suitable(url) {
        if (CDN_URL.test(url))
            return true;
        const m = url.match(PSEUDO_URL);
        if (!m?.groups)
            return false;
        if (m.groups.kind === "channels")
            return false; // listing only
        // Accept any channel slug — catalog is discovered at extract time.
        return !!(m.groups.id);
    }
    static listUrlSupported(url) {
        const m = url.match(PSEUDO_URL);
        return m?.groups?.kind === "channels";
    }
    async extract(url) {
        const resolved = await this.resolveTarget(url);
        const tokenLp = resolved.tokenUrl || resolved.streamUrl;
        const ticket = await (0, token_1.fetchMakoTicket)(this.request, tokenLp);
        const playUrl = (0, token_1.buildAuthorizedMakoUrl)(resolved.streamUrl, ticket);
        const probe = await this.request.request(playUrl, { headers: token_1.MAKO_REQUEST_HEADERS });
        if (probe.statusCode !== 200 || !/#EXTM3U/i.test(String(probe.body || ""))) {
            throw new Error(`mako: stream unavailable for "${resolved.id}" (HTTP ${probe.statusCode}) — CDN path may be retired`);
        }
        const format = (0, helpers_1.hlsFormat)(playUrl, "hls");
        format.http_headers = { ...token_1.MAKO_REQUEST_HEADERS };
        format.manifest_url = playUrl;
        return (0, helpers_1.baseInfo)(MakoIE.IE_NAME, resolved.pageUrl, {
            id: resolved.id,
            display_id: resolved.id,
            title: resolved.name,
            thumbnail: resolved.thumbnail || null,
            live_status: "is_live",
            age_limit: 0,
            formats: [format],
        });
    }
    async listVideos(url, options = {}) {
        const m = url.match(PSEUDO_URL);
        if (m?.groups?.kind !== "channels") {
            throw new Error("mako: not a listing URL (use mako:channels or mako:channels:live|free|extra)");
        }
        const group = m.groups.group;
        const { channels: discovered, source } = await (0, discover_1.getMakoCatalog)(this.request, { group });
        let channels = discovered;
        if (options.limit && options.limit > 0)
            channels = channels.slice(0, options.limit);
        return {
            extractor: MakoIE.IE_NAME,
            webpage_url: (0, channels_1.makoListingUrl)(group),
            playlist_id: group || "all",
            playlist_title: group
                ? `Mako ${group}`
                : source === "site"
                    ? "Mako channels (site)"
                    : "Mako channels (fallback)",
            page: 1,
            entries: channels.map(ch => ({
                id: ch.id,
                url: (0, channels_1.makoChannelPageUrl)(ch.id),
                title: ch.name,
                display_id: ch.id,
                thumbnail: ch.thumbnail || null,
            })),
            next_page_url: null,
        };
    }
    async listCategories(_url = "mako:channels", options = {}) {
        let entries = [
            { id: "all", title: "All channels", url: (0, channels_1.makoListingUrl)() },
            { id: "live", title: "Live (Keshet 12 / 24)", url: (0, channels_1.makoListingUrl)("live") },
            { id: "free", title: "Free linear", url: (0, channels_1.makoListingUrl)("free") },
            { id: "extra", title: "Extra / shows", url: (0, channels_1.makoListingUrl)("extra") },
        ];
        if (options.limit && options.limit > 0)
            entries = entries.slice(0, options.limit);
        return {
            extractor: MakoIE.IE_NAME,
            webpage_url: (0, channels_1.makoListingUrl)(),
            entries,
        };
    }
    async resolveTarget(url) {
        if (CDN_URL.test(url)) {
            const u = new URL(url);
            // Strip prior hdnea tickets so we mint a fresh one.
            u.searchParams.delete("hdnea");
            ["st", "exp", "acl", "hmac"].forEach(k => u.searchParams.delete(k));
            const clean = u.toString().replace(/\?$/, "");
            const { channels } = await (0, discover_1.getMakoCatalog)(this.request);
            const known = channels.find(c => c.streamUrl === clean ||
                c.tokenUrl === clean ||
                c.streamUrl.split("?")[0] === clean.split("?")[0]);
            return {
                id: known?.id || slugFromCdnPath(u.pathname),
                name: known?.name || slugFromCdnPath(u.pathname),
                streamUrl: known?.streamUrl || clean,
                tokenUrl: known?.tokenUrl,
                thumbnail: known?.thumbnail,
                pageUrl: known ? (0, channels_1.makoChannelPageUrl)(known.id) : clean,
            };
        }
        const m = url.match(PSEUDO_URL);
        const id = m?.groups?.id;
        if (!id)
            throw new Error(`mako: invalid URL ${url}`);
        const { channels } = await (0, discover_1.getMakoCatalog)(this.request);
        const channel = (0, discover_1.findInMakoCatalog)(channels, id);
        if (!channel)
            throw new Error(`mako: unknown channel id "${id}" (try mako:channels)`);
        return {
            id: channel.id,
            name: channel.name,
            streamUrl: channel.streamUrl,
            tokenUrl: channel.tokenUrl,
            thumbnail: channel.thumbnail,
            pageUrl: (0, channels_1.makoChannelPageUrl)(channel.id),
        };
    }
}
exports.MakoIE = MakoIE;
function slugFromCdnPath(pathname) {
    const parts = pathname.split("/").filter(Boolean);
    const idx = parts.findIndex(p => p === "live");
    if (idx >= 0 && parts[idx + 2])
        return parts[idx + 2].replace(/\.m3u8$/i, "");
    return parts[parts.length - 2] || "mako";
}
//# sourceMappingURL=mako.js.map