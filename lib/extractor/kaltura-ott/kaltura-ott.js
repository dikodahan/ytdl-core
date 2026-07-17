"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePartnerPreset = exports.KALTURA_OTT_PRESETS = exports.KalturaOttIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const client_1 = require("./client");
const presets_1 = require("./presets");
Object.defineProperty(exports, "KALTURA_OTT_PRESETS", { enumerable: true, get: function () { return presets_1.KALTURA_OTT_PRESETS; } });
Object.defineProperty(exports, "resolvePartnerPreset", { enumerable: true, get: function () { return presets_1.resolvePartnerPreset; } });
/** Pseudo-URL scheme for Kaltura OTT TV (live channels, EPG, catch-up). */
const VALID_URL = /^kaltura-ott:(?<partner>\w+)(?::(?<kind>categories|channels|lineup|live|epg|program)(?::(?<id>\d+))?)?(?:\?(?<query>[^#]*))?$/i;
const LIST_KINDS = new Set(["categories", "channels", "lineup", "epg"]);
const EXTRACT_KINDS = new Set(["live", "program"]);
function parseOttUrl(url) {
    const m = url.match(VALID_URL);
    if (!m?.groups?.partner)
        throw new Error(`Invalid Kaltura OTT URL: ${url}`);
    const kind = (m.groups.kind || "root");
    return {
        partnerKey: m.groups.partner,
        kind,
        id: m.groups.id,
        query: new URLSearchParams(m.groups.query || ""),
        raw: url,
    };
}
function pageUrl(partner, kind, id, query) {
    const q = query?.toString();
    const base = id ? `kaltura-ott:${partner}:${kind}:${id}` : `kaltura-ott:${partner}:${kind}`;
    return q ? `${base}?${q}` : base;
}
class KalturaOttIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "kaltura-ott";
    static IE_DESC = "Kaltura OTT TV — live channels, EPG, and catch-up playback";
    static _VALID_URL = VALID_URL;
    static getInfo() {
        return {
            name: KalturaOttIE.IE_NAME,
            description: `${KalturaOttIE.IE_DESC} (Cellcom, Reshet, and other OTT partners)`,
            validUrl: String(KalturaOttIE._VALID_URL),
            options: [
                {
                    key: "applicationName",
                    label: "Android app FQDN",
                    type: "string",
                    description: "Android package name, e.g. com.kaltura.reshet.atv",
                    default: "",
                },
                {
                    key: "partnerId",
                    label: "Partner ID",
                    type: "number",
                    description: "Numeric Kaltura OTT partner ID, e.g. 5031",
                    default: "",
                },
                {
                    key: "days",
                    label: "EPG days",
                    type: "number",
                    description: "Days of EPG to fetch when listing or extracting programs",
                    default: 4,
                },
            ],
            notes: "Use pseudo-URLs like `kaltura-ott:reshet:live:2605018` or `kaltura-ott:cellcom:epg:3728`. Built-in presets: reshet (5031), cellcom (3197).",
            listSupported: true,
        };
    }
    static suitable(url) {
        if (!VALID_URL.test(url))
            return false;
        try {
            const { kind } = parseOttUrl(url);
            return EXTRACT_KINDS.has(kind);
        }
        catch {
            return false;
        }
    }
    static listUrlSupported(url) {
        if (!VALID_URL.test(url))
            return false;
        const { kind } = parseOttUrl(url);
        if (kind === "root")
            return true;
        return LIST_KINDS.has(kind);
    }
    resolvePreset(partnerKey) {
        const base = (0, presets_1.resolvePartnerPreset)(partnerKey);
        if (!base) {
            throw new Error(`Unknown Kaltura OTT partner "${partnerKey}". Use reshet, cellcom, or a numeric partner id.`);
        }
        const overrides = this.params.extractorArgs?.kalturaOtt;
        return (0, presets_1.mergePresetOverrides)(base, overrides);
    }
    client(preset) {
        return new client_1.KalturaOttClient(this.request, preset);
    }
    epgDays(parsed, preset) {
        const fromQuery = Number(parsed.query.get("days"));
        if (Number.isFinite(fromQuery) && fromQuery > 0)
            return Math.min(Math.floor(fromQuery), 14);
        const fromArgs = Number(this.params.extractorArgs?.kalturaOttDays);
        if (Number.isFinite(fromArgs) && fromArgs > 0)
            return Math.min(Math.floor(fromArgs), 14);
        return preset.defaultEpgDays;
    }
    async extract(url) {
        const parsed = parseOttUrl(url);
        if (!EXTRACT_KINDS.has(parsed.kind)) {
            throw new Error(`kaltura-ott: use :live:{assetId} or :program:{assetId} for extraction (got ${parsed.kind})`);
        }
        if (!parsed.id)
            throw new Error(`kaltura-ott: missing asset id in URL: ${url}`);
        const preset = this.resolvePreset(parsed.partnerKey);
        const client = this.client(preset);
        const assetId = Number(parsed.id);
        if (parsed.kind === "live") {
            return this.extractLive(url, parsed, preset, client, assetId);
        }
        return this.extractProgram(url, parsed, preset, client, assetId);
    }
    async extractLive(url, parsed, preset, client, assetId) {
        const asset = await client.getLiveAsset(assetId);
        const { hls, dash } = (0, client_1.pickStreamFormats)(asset.mediaFiles);
        const formats = [];
        if (hls)
            formats.push((0, helpers_1.hlsFormat)(hls, "hls"));
        if (dash)
            formats.push((0, helpers_1.dashFormat)(dash, "dash"));
        if (!formats.length) {
            throw new Error(`Kaltura OTT live asset ${assetId} has no HLS/DASH streams`);
        }
        const channelNum = asset.metas?.ChannelNumber?.value;
        if (channelNum != null && formats[0]) {
            formats[0].format_note = `Channel ${channelNum}`;
        }
        return (0, helpers_1.baseInfo)(KalturaOttIE.IE_NAME, url, {
            id: String(assetId),
            display_id: asset.externalIds || asset.externalId || String(assetId),
            title: asset.name || `Channel ${assetId}`,
            description: asset.description || null,
            thumbnail: (0, client_1.pickChannelLogo)(asset.images),
            live_status: "is_live",
            uploader: preset.alias,
            formats,
        });
    }
    async extractProgram(url, parsed, preset, client, programId) {
        let program = null;
        let sources = [];
        let playbackNote = null;
        for (const ctx of ["CATCHUP", "START_OVER", "PLAYBACK"]) {
            try {
                sources = await client.getProgramPlayback(programId, ctx);
                if (sources.length)
                    break;
            }
            catch {
                /* try next context */
            }
        }
        try {
            program = await client.getProgramAsset(programId);
        }
        catch {
            program = null;
        }
        const formats = [];
        for (const src of sources) {
            if (!src.url)
                continue;
            const type = (src.type || src.format || "").toUpperCase();
            if (type.includes("HLS") || src.url.includes(".m3u8")) {
                formats.push((0, helpers_1.hlsFormat)(src.url, `hls-${formats.length + 1}`));
            }
            else if (type.includes("DASH") || src.url.includes(".mpd")) {
                formats.push((0, helpers_1.dashFormat)(src.url, `dash-${formats.length + 1}`));
            }
            else {
                formats.push((0, helpers_1.hlsFormat)(src.url, `stream-${formats.length + 1}`));
            }
        }
        if (!formats.length && program?.linearAssetId) {
            playbackNote =
                "Catch-up playback unavailable with anonymous session; falling back to parent live channel stream.";
            try {
                const live = await this.extractLive(pageUrl(parsed.partnerKey, "live", String(program.linearAssetId)), { ...parsed, kind: "live", id: String(program.linearAssetId) }, preset, client, program.linearAssetId);
                return {
                    ...live,
                    id: String(programId),
                    display_id: program.externalId || String(programId),
                    title: program.name || live.title,
                    description: [program.description, playbackNote].filter(Boolean).join(" "),
                    thumbnail: (0, client_1.pickChannelLogo)(program.images) || live.thumbnail,
                    live_status: program.endDate && program.endDate < Date.now() / 1000 ? "was_live" : "is_live",
                    timestamp: program.startDate ?? null,
                    duration: program.startDate && program.endDate
                        ? Math.max(0, program.endDate - program.startDate)
                        : null,
                    webpage_url: url,
                    original_url: url,
                };
            }
            catch {
                /* fall through */
            }
        }
        if (!formats.length) {
            throw new Error(`Kaltura OTT program ${programId} has no playable streams (catch-up may require subscription)`);
        }
        return (0, helpers_1.baseInfo)(KalturaOttIE.IE_NAME, url, {
            id: String(programId),
            display_id: program?.externalId || String(programId),
            title: program?.name || `Program ${programId}`,
            description: program?.description || playbackNote,
            thumbnail: (0, client_1.pickChannelLogo)(program?.images),
            timestamp: program?.startDate ?? null,
            duration: program?.startDate && program?.endDate
                ? Math.max(0, program.endDate - program.startDate)
                : null,
            formats,
        });
    }
    async listVideos(url, options = {}) {
        const parsed = parseOttUrl(url);
        const preset = this.resolvePreset(parsed.partnerKey);
        const client = this.client(preset);
        const partner = preset.alias;
        await client.ensureSession();
        if (parsed.kind === "epg") {
            if (!parsed.id) {
                throw new Error(`kaltura-ott: EPG listing requires a channel id, e.g. kaltura-ott:${partner}:epg:2605018`);
            }
            const days = this.epgDays(parsed, preset);
            let channelAssets;
            if (preset.epgStyle === "search") {
                channelAssets = await client.listChannels(preset.defaultLineupId);
            }
            const programs = await client.fetchEpgPrograms(parsed.id, days, channelAssets);
            let entries = programs.map(p => programListEntry(partner, p, parsed.query));
            if (options.limit && options.limit > 0)
                entries = entries.slice(0, options.limit);
            return {
                extractor: KalturaOttIE.IE_NAME,
                webpage_url: url,
                playlist_id: `epg-${parsed.id}`,
                playlist_title: `EPG channel ${parsed.id} (${days} days)`,
                page: options.page || 1,
                entries,
                next_page_url: null,
            };
        }
        const lineupId = resolveLineupId(parsed, preset);
        const channels = await client.listChannels(lineupId);
        let entries = channels
            .filter(c => c.id != null)
            .map(c => channelListEntry(partner, c));
        if (options.limit && options.limit > 0)
            entries = entries.slice(0, options.limit);
        return {
            extractor: KalturaOttIE.IE_NAME,
            webpage_url: url,
            playlist_id: String(lineupId),
            playlist_title: `${preset.lineups.find(l => l.id === lineupId)?.title || partner} channels`,
            page: 1,
            entries,
            next_page_url: null,
        };
    }
    async listCategories(url, options = {}) {
        const parsed = parseOttUrl(url?.trim() || "kaltura-ott:reshet:categories");
        const preset = this.resolvePreset(parsed.partnerKey);
        const partner = preset.alias;
        let entries = preset.lineups.map(lineup => ({
            id: String(lineup.id),
            title: lineup.title,
            url: pageUrl(partner, "lineup", String(lineup.id)),
        }));
        if (!entries.length && preset.defaultLineupId) {
            entries = [
                {
                    id: String(preset.defaultLineupId),
                    title: `${partner} channels`,
                    url: pageUrl(partner, "channels"),
                },
            ];
        }
        entries.push({
            id: "channels",
            title: "All live channels (default lineup)",
            url: pageUrl(partner, "channels"),
        });
        if (options.limit && options.limit > 0) {
            entries = entries.slice(0, options.limit);
        }
        return {
            extractor: KalturaOttIE.IE_NAME,
            webpage_url: url?.trim() || pageUrl(partner, "categories"),
            entries,
        };
    }
}
exports.KalturaOttIE = KalturaOttIE;
function resolveLineupId(parsed, preset) {
    if (parsed.kind === "lineup" && parsed.id)
        return Number(parsed.id);
    if (parsed.query.get("lineup"))
        return Number(parsed.query.get("lineup"));
    if (preset.defaultLineupId)
        return preset.defaultLineupId;
    throw new Error("No lineup id configured for this Kaltura OTT partner");
}
function channelListEntry(partner, asset) {
    const id = String(asset.id);
    return {
        id,
        display_id: asset.externalIds || asset.externalId || id,
        title: asset.name || id,
        thumbnail: (0, client_1.pickChannelLogo)(asset.images),
        url: pageUrl(partner, "live", id),
    };
}
function programListEntry(partner, program, query) {
    const id = String(program.id);
    const q = new URLSearchParams(query);
    return {
        id,
        display_id: program.externalId || id,
        title: program.name || id,
        thumbnail: (0, client_1.pickChannelLogo)(program.images),
        url: pageUrl(partner, "program", id, q),
    };
}
//# sourceMappingURL=kaltura-ott.js.map