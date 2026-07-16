"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KalturaOttClient = void 0;
exports.pickChannelLogo = pickChannelLogo;
exports.pickStreamFormats = pickStreamFormats;
const EPG_UNAVAILABLE = "המידע אינו זמין";
class KalturaOttClient {
    request;
    preset;
    session = null;
    constructor(request, preset) {
        this.request = request;
        this.preset = preset;
    }
    async ensureSession() {
        const now = Math.floor(Date.now() / 1000);
        if (this.session?.ks && this.session.expiry && this.session.expiry > now + 60) {
            return this.session;
        }
        if (this.preset.deviceConfig) {
            await this.serveByDevice();
        }
        const loginPath = this.preset.apiVersion.startsWith("5.")
            ? "/api_v3/service/OTTUser/action/anonymousLogin"
            : "/api_v3/service/ottuser/action/anonymousLogin";
        const loginUrl = `${this.preset.apiHost}${loginPath}`;
        const body = {
            partnerId: this.preset.partnerId,
            udid: this.preset.udid,
            apiVersion: this.preset.apiVersion,
        };
        if (this.preset.apiVersion.startsWith("5.")) {
            body.clientTag = this.preset.clientTag;
        }
        else {
            Object.assign(body, {
                ignoreNull: true,
                format: 1,
                clientTag: this.preset.clientTag,
            });
        }
        const res = await this.request.request(loginUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": this.preset.userAgent,
            },
            body: JSON.stringify(body),
        });
        if (res.statusCode >= 400) {
            throw new Error(`Kaltura OTT login failed: HTTP ${res.statusCode}`);
        }
        const data = res.json();
        const ks = data.result?.ks;
        if (!ks)
            throw new Error("Kaltura OTT login did not return ks");
        const sessionHeader = headerValue(res.headers, "x-kaltura-session") ||
            headerValue(res.headers, "X-Kaltura-Session");
        this.session = {
            ks,
            sessionId: sessionHeader,
            expiry: data.result?.expiry ?? null,
        };
        return this.session;
    }
    async serveByDevice() {
        const cfg = this.preset.deviceConfig;
        if (!cfg)
            return;
        const url = "https://api.frp1.ott.kaltura.com/api_v3/service/configurations/action/serveByDevice";
        await this.request.json(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": this.preset.userAgent,
            },
            body: JSON.stringify({
                apiVersion: this.preset.apiVersion.split(".")[0] + ".5.0",
                applicationName: cfg.applicationName,
                clientVersion: cfg.clientVersion,
                partnerId: this.preset.partnerId,
                platform: cfg.platform,
                tag: cfg.tag,
                udid: this.preset.udid,
            }),
        }).catch(() => undefined);
    }
    apiBase() {
        return this.preset.apiHost.replace(/\/+$/, "");
    }
    async postApi(path, payload) {
        const session = await this.ensureSession();
        const url = `${this.apiBase()}${path}`;
        return this.request.json(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": this.preset.userAgent,
            },
            body: JSON.stringify({ ...payload, ks: session.ks }),
        }).then(data => {
            if (!data.result)
                throw new Error(`Kaltura OTT empty response for ${path}`);
            return data.result;
        });
    }
    async listChannels(lineupId, pageSize = 500) {
        const filter = {
            objectType: "KalturaChannelFilter",
            idEqual: lineupId,
        };
        if (this.preset.channelFilterKsql) {
            filter.kSql = this.preset.channelFilterKsql;
        }
        if (this.preset.alias === "reshet") {
            filter.dynamicOrderBy = {
                orderBy: "META_ASC",
                objectType: "KalturaDynamicOrderBy",
                name: "ChannelNumber",
            };
        }
        const pager = {
            objectType: "KalturaFilterPager",
            pageIndex: 1,
            pageSize,
        };
        const payload = {
            filter,
            pager,
            apiVersion: this.preset.apiVersion,
            clientTag: this.preset.clientTag,
        };
        if (!this.preset.apiVersion.startsWith("5.")) {
            payload.ignoreNull = true;
            payload.format = 1;
            payload.language = "en";
        }
        const result = await this.postApi("/api_v3/service/asset/action/list", payload);
        return result.objects || [];
    }
    async getLiveAsset(assetId) {
        const channels = await this.listChannels(this.preset.defaultLineupId, 1000);
        const found = channels.find(c => c.id === assetId);
        if (found)
            return found;
        const result = await this.postApi("/api_v3/service/asset/action/list", {
            filter: { objectType: "KalturaAssetFilter", idIn: String(assetId) },
            pager: { pageIndex: 1, pageSize: 1 },
            apiVersion: this.preset.apiVersion,
            clientTag: this.preset.clientTag,
            ignoreNull: true,
            format: 1,
        });
        const asset = result.objects?.[0];
        if (!asset)
            throw new Error(`Kaltura OTT live asset ${assetId} not found`);
        return asset;
    }
    async fetchEpgPrograms(channelRef, days, channelAssets) {
        if (this.preset.epgStyle === "cache") {
            return this.fetchEpgCache(channelRef, days);
        }
        return this.fetchEpgSearch(channelRef, days, channelAssets);
    }
    async fetchEpgCache(channelAssetId, days) {
        const session = await this.ensureSession();
        if (!this.preset.epgHost) {
            throw new Error("EPG cache host is not configured for this partner");
        }
        if (!session.sessionId) {
            throw new Error("Kaltura OTT EPG cache requires X-Kaltura-Session header from login");
        }
        const combined = [];
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        for (let offset = 0; offset < days; offset++) {
            const day = new Date(today);
            day.setUTCDate(day.getUTCDate() + offset);
            const epoch = Math.floor(day.getTime() / 1000);
            const url = `${this.preset.epgHost}/api_v3/service/epg/action/get/date/${epoch}/slots/all` +
                `?channels=${encodeURIComponent(channelAssetId)}&pageIndex=1&pageSize=400&offsetInMin=-300`;
            const res = await this.request.request(url, {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json; charset=utf-8",
                    "User-Agent": this.preset.userAgent,
                    Authorization: `Bearer ${session.ks}`,
                    "X-Kaltura-Session": session.sessionId,
                    "X-Kaltura-Session-Id": session.sessionId,
                },
            });
            if (res.statusCode >= 400) {
                throw new Error(`Kaltura OTT EPG failed: HTTP ${res.statusCode}`);
            }
            const data = res.json();
            const chunk = data.epgChunk?.[channelAssetId] || [];
            combined.push(...chunk);
        }
        return filterEpgPrograms(combined, this.preset.epgUnavailableTitle);
    }
    async fetchEpgSearch(channelRef, days, channelAssets) {
        let epgChannelId = channelRef;
        const numericRef = Number(channelRef);
        if (channelAssets?.length && Number.isFinite(numericRef)) {
            const byAsset = channelAssets.find(c => c.id === numericRef);
            if (byAsset?.externalIds)
                epgChannelId = byAsset.externalIds;
            else if (byAsset && !byAsset.externalIds && byAsset.externalId) {
                epgChannelId = byAsset.externalId;
            }
        }
        const now = Math.floor(Date.now() / 1000);
        const end = now + days * 86400;
        const kSql = `(and epg_channel_id='${epgChannelId}' start_date>'${now - 3600}' end_date<'${end}' asset_type='epg')`;
        const result = await this.postApi("/api_v3/service/asset/action/list", {
            apiVersion: this.preset.apiVersion,
            clientTag: this.preset.clientTag,
            filter: {
                kSql,
                objectType: "KalturaSearchAssetFilter",
                orderBy: "START_DATE_ASC",
            },
            pager: { pageIndex: 1, pageSize: 1000 },
        });
        return filterEpgPrograms(result.objects || [], this.preset.epgUnavailableTitle);
    }
    async getProgramPlayback(programId, context = "CATCHUP") {
        const payload = {
            apiVersion: this.preset.apiVersion,
            clientTag: this.preset.clientTag,
            ignoreNull: true,
            format: 1,
            assetId: programId,
            assetType: "epg",
            contextDataParams: {
                objectType: "KalturaPlaybackContextOptions",
                context,
                assetReferenceType: "epg_internal",
            },
        };
        const result = await this.postApi("/api_v3/service/asset/action/getPlaybackContext", payload);
        if (result.error) {
            throw new Error(result.error.message || "Playback not available");
        }
        return result.sources || [];
    }
    async getProgramAsset(programId) {
        const result = await this.postApi("/api_v3/service/asset/action/list", {
            filter: { objectType: "KalturaAssetFilter", idIn: String(programId) },
            pager: { pageIndex: 1, pageSize: 1 },
            apiVersion: this.preset.apiVersion,
            clientTag: this.preset.clientTag,
            ignoreNull: true,
            format: 1,
        });
        const asset = result.objects?.[0];
        if (!asset)
            throw new Error(`Kaltura OTT program ${programId} not found`);
        return asset;
    }
}
exports.KalturaOttClient = KalturaOttClient;
function filterEpgPrograms(programs, unavailableTitle) {
    const skip = unavailableTitle || EPG_UNAVAILABLE;
    const seen = new Set();
    const out = [];
    for (const p of programs) {
        if (!p.id)
            continue;
        if (p.name === skip)
            continue;
        const key = `${p.id}:${p.startDate}:${p.endDate}:${p.name}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(p);
    }
    out.sort((a, b) => (a.startDate || 0) - (b.startDate || 0));
    return out;
}
function headerValue(headers, name) {
    const direct = headers[name];
    if (typeof direct === "string")
        return direct;
    if (Array.isArray(direct) && direct[0])
        return direct[0];
    const lower = name.toLowerCase();
    for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() === lower) {
            if (typeof v === "string")
                return v;
            if (Array.isArray(v) && v[0])
                return v[0];
        }
    }
    return null;
}
function pickChannelLogo(images) {
    if (!images?.length)
        return null;
    const preferred = ["TVGuide_1x1", "16x9", "1x1"];
    for (const name of preferred) {
        const img = images.find(i => i.imageTypeName === name && i.url);
        if (img?.url)
            return img.url;
    }
    return images.find(i => i.url)?.url || null;
}
function pickStreamFormats(files) {
    let hls = null;
    let dash = null;
    for (const f of files || []) {
        if (!f.url)
            continue;
        const type = (f.type || "").toUpperCase();
        if (!hls && (type.includes("HLS") || f.url.includes(".m3u8")))
            hls = f.url;
        if (!dash && (type.includes("DASH") || f.url.includes(".mpd")))
            dash = f.url;
    }
    return { hls, dash };
}
//# sourceMappingURL=client.js.map