"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KalturaIE = void 0;
const info_extractor_1 = require("../../core/info-extractor");
const helpers_1 = require("../_shared/helpers");
const SERVICE_URL = "https://cdnapi.kaltura.com";
const SERVICE_BASE = "/api_v3/service/multirequest";
class KalturaIE extends info_extractor_1.InfoExtractor {
    static IE_NAME = "kaltura";
    static IE_DESC = "Kaltura embeds / partner entries";
    static _VALID_URL = /(?:kaltura:(?<partner_id>\w+):(?<id>\w+)|https?:\/\/(?:(?:www|cdnapi(?:sec)?)\.)?kaltura\.com(?::\d+)?\/(?:index\.php\/(?:kwidget|extwidget\/preview)|html5\/html5lib\/[^/]+\/mwEmbedFrame\.php)(?:\/(?<path>[^?]+))?(?:\?(?<query>.*))?)/i;
    async extract(url) {
        const { partnerId, entryId } = this.parseIds(url);
        const widgetId = partnerId.includes("_") ? partnerId : `_${partnerId}`;
        const actions = [
            {
                apiVersion: "3.3.0",
                clientTag: "html5:v3.1.0",
                format: 1,
                ks: "",
                partnerId,
            },
            {
                expiry: 86400,
                service: "session",
                action: "startWidgetSession",
                widgetId,
            },
            {
                action: "list",
                filter: { redirectFromEntryId: entryId },
                service: "baseentry",
                ks: "{1:result:ks}",
                responseProfile: {
                    type: 1,
                    fields: "createdAt,dataUrl,duration,name,plays,thumbnailUrl,userId,description",
                },
            },
            {
                action: "getbyentryid",
                entryId,
                service: "flavorAsset",
                ks: "{1:result:ks}",
            },
        ];
        const params = { ...actions[0] };
        actions.slice(1).forEach((a, i) => {
            params[String(i + 1)] = a;
        });
        const data = await this.request.json(SERVICE_URL + SERVICE_BASE, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(params),
        });
        for (const [idx, status] of data.entries()) {
            if (status &&
                typeof status === "object" &&
                status.objectType === "KalturaAPIException") {
                const msg = status.message || "Kaltura API error";
                throw new Error(`kaltura said: ${msg} (${idx})`);
            }
        }
        const infoList = data[2];
        const info = infoList && typeof infoList === "object" && "objects" in infoList
            ? infoList.objects?.[0] || {}
            : infoList || {};
        const flavorAssets = data[3] || [];
        const dataUrl = info.dataUrl || "";
        const formats = [];
        for (const f of flavorAssets) {
            if (f.status != null && f.status !== 2)
                continue;
            if (f.fileExt === "chun" || f.fileExt === "wvm")
                continue;
            const ext = f.fileExt || (f.containerFormat === "qt" ? "mov" : "mp4");
            if (!f.id || !dataUrl)
                continue;
            const videoUrl = `${dataUrl.replace(/\/flvclipper\/.*/, "/serveFlavor")}/flavorId/${f.id}`;
            const isAudio = !f.videoCodecId && f.frameRate === 0;
            formats.push((0, helpers_1.progressiveFormat)(videoUrl, {
                format_id: `${ext}-${f.bitrate || "0"}`,
                ext,
                width: f.width ?? null,
                height: f.height ?? null,
                tbr: f.bitrate ?? null,
                filesize: f.size ?? null,
                has_video: !isAudio,
                vcodec: isAudio ? "none" : f.videoCodecId || "unknown",
            }));
        }
        if (dataUrl.includes("/playManifest/")) {
            const m3u8 = dataUrl.replace("format/url", "format/applehttp");
            formats.push((0, helpers_1.hlsFormat)(m3u8));
        }
        if (!formats.length) {
            throw new Error(`Kaltura entry ${entryId} has no playable formats`);
        }
        return (0, helpers_1.baseInfo)(KalturaIE.IE_NAME, url, {
            id: info.id || entryId,
            title: info.name || entryId,
            description: info.description || null,
            thumbnail: info.thumbnailUrl,
            duration: info.duration ?? null,
            timestamp: info.createdAt ?? null,
            uploader_id: info.userId || null,
            view_count: info.plays ?? null,
            formats,
        });
    }
    parseIds(url) {
        const m = url.match(KalturaIE._VALID_URL);
        if (!m)
            throw new Error(`Could not parse Kaltura URL: ${url}`);
        if (m.groups?.partner_id && m.groups?.id) {
            return { partnerId: m.groups.partner_id, entryId: m.groups.id };
        }
        const params = {};
        if (m.groups?.query) {
            for (const [k, v] of new URLSearchParams(m.groups.query)) {
                params[k] = v;
            }
        }
        if (m.groups?.path) {
            const parts = m.groups.path.split("/");
            for (let i = 0; i + 1 < parts.length; i += 2) {
                params[parts[i]] = parts[i + 1];
            }
        }
        let partnerId = params.partner_id ||
            params.p ||
            (params.wid ? params.wid.replace(/^_/, "") : "");
        const entryId = params.entry_id || params.entryId;
        if (!partnerId || !entryId) {
            throw new Error(`Could not extract Kaltura partner/entry from URL: ${url}`);
        }
        return { partnerId, entryId };
    }
}
exports.KalturaIE = KalturaIE;
//# sourceMappingURL=kaltura.js.map