"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KALTURA_OTT_PRESETS = void 0;
exports.resolvePartnerPreset = resolvePartnerPreset;
exports.mergePresetOverrides = mergePresetOverrides;
const CELLCOM_CHANNEL_KSQL = "(and customer_type_blacklist!='1' deep_link_type!='netflix' (and PPV_module!+'') deep_link_type!='youtube' deep_link_type!='amazon' Is_adult!='1' deep_link_type!='screenz')";
exports.KALTURA_OTT_PRESETS = {
    cellcom: {
        alias: "cellcom",
        partnerId: 3197,
        apiHost: "https://api.frp1.ott.kaltura.com",
        apiVersion: "5.4.0.28193",
        clientTag: "2500009-Android",
        udid: "f4423331-81a2-4a08-8c62-95515d080d79",
        userAgent: "okhttp/5.0.0-alpha.6",
        defaultLineupId: 353891,
        lineups: [{ id: 353891, title: "Cellcom TV channels" }],
        epgStyle: "search",
        channelFilterKsql: CELLCOM_CHANNEL_KSQL,
        defaultEpgDays: 3,
    },
    reshet: {
        alias: "reshet",
        partnerId: 5031,
        apiHost: "https://5031.frp1.ott.kaltura.com",
        epgHost: "https://cache.frp1.ott.kaltura.com",
        apiVersion: "8.5.0.30179",
        clientTag: "java:23-02-06",
        udid: "405373f4b02c0b23",
        userAgent: "okhttp/5.0.0-alpha.6",
        defaultLineupId: 360478,
        lineups: [{ id: 360478, title: "Reshet TV channels" }],
        epgStyle: "cache",
        epgUnavailableTitle: "המידע אינו זמין",
        deviceConfig: {
            applicationName: "com.kaltura.reshet.atv",
            clientVersion: "1.0.0",
            platform: "STB",
            tag: "ReshetProd",
        },
        defaultEpgDays: 4,
    },
};
function resolvePartnerPreset(partnerKey) {
    const key = partnerKey.trim().toLowerCase();
    if (exports.KALTURA_OTT_PRESETS[key])
        return exports.KALTURA_OTT_PRESETS[key];
    const numeric = Number(partnerKey);
    if (Number.isFinite(numeric) && numeric > 0) {
        for (const preset of Object.values(exports.KALTURA_OTT_PRESETS)) {
            if (preset.partnerId === numeric)
                return preset;
        }
        return buildGenericPreset(numeric);
    }
    return null;
}
function buildGenericPreset(partnerId) {
    return {
        alias: String(partnerId),
        partnerId,
        apiHost: `https://${partnerId}.frp1.ott.kaltura.com`,
        epgHost: "https://cache.frp1.ott.kaltura.com",
        apiVersion: "8.5.0.30179",
        clientTag: "java:23-02-06",
        udid: "405373f4b02c0b23",
        userAgent: "okhttp/5.0.0-alpha.6",
        defaultLineupId: 0,
        lineups: [],
        epgStyle: "cache",
        defaultEpgDays: 2,
    };
}
function mergePresetOverrides(preset, overrides) {
    if (!overrides || typeof overrides !== "object")
        return preset;
    const o = overrides;
    return {
        ...preset,
        ...(typeof o.apiHost === "string" ? { apiHost: o.apiHost } : {}),
        ...(typeof o.epgHost === "string" ? { epgHost: o.epgHost } : {}),
        ...(typeof o.apiVersion === "string" ? { apiVersion: o.apiVersion } : {}),
        ...(typeof o.clientTag === "string" ? { clientTag: o.clientTag } : {}),
        ...(typeof o.udid === "string" ? { udid: o.udid } : {}),
        ...(typeof o.defaultLineupId === "number" ? { defaultLineupId: o.defaultLineupId } : {}),
        ...(typeof o.channelFilterKsql === "string" ? { channelFilterKsql: o.channelFilterKsql } : {}),
        ...(o.epgStyle === "cache" || o.epgStyle === "search" ? { epgStyle: o.epgStyle } : {}),
        ...(typeof o.defaultEpgDays === "number" ? { defaultEpgDays: o.defaultEpgDays } : {}),
    };
}
//# sourceMappingURL=presets.js.map