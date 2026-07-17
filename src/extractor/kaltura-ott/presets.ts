export interface KalturaOttLineup {
  id: number;
  title: string;
}

export type KalturaOttEpgStyle = "cache" | "search";

export interface KalturaOttDeviceConfig {
  applicationName: string;
  clientVersion: string;
  platform: string;
  tag: string;
}

/** Built-in partner presets (Cellcom, Reshet) plus optional overrides via extractorArgs. */
export interface KalturaOttPartnerPreset {
  alias: string;
  partnerId: number;
  /** Primary OTT API host, e.g. `https://5031.frp1.ott.kaltura.com`. */
  apiHost: string;
  /** EPG cache host (Reshet-style). When set with `epgStyle: "cache"`. */
  epgHost?: string;
  apiVersion: string;
  clientTag: string;
  udid: string;
  userAgent: string;
  defaultLineupId: number;
  lineups: KalturaOttLineup[];
  epgStyle: KalturaOttEpgStyle;
  /** Optional kSql appended to KalturaChannelFilter (Cellcom adult/PPV exclusions). */
  channelFilterKsql?: string;
  /** Skip EPG rows with this exact title (Hebrew placeholder on Reshet). */
  epgUnavailableTitle?: string;
  /** Optional device bootstrap before login (Reshet ATV). */
  deviceConfig?: KalturaOttDeviceConfig;
  defaultEpgDays: number;
}

const CELLCOM_CHANNEL_KSQL =
  "(and customer_type_blacklist!='1' deep_link_type!='netflix' (and PPV_module!+'') deep_link_type!='youtube' deep_link_type!='amazon' Is_adult!='1' deep_link_type!='screenz')";

export const KALTURA_OTT_PRESETS: Record<string, KalturaOttPartnerPreset> = {
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
    deviceConfig: {
      applicationName: "com.cellcom.cellcomtv",
      clientVersion: "1.0.0",
      platform: "Android",
      tag: "CellcomTV",
    },
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

export function resolvePartnerPreset(partnerKey: string): KalturaOttPartnerPreset | null {
  const key = partnerKey.trim().toLowerCase();
  if (KALTURA_OTT_PRESETS[key]) return KALTURA_OTT_PRESETS[key];

  const numeric = Number(partnerKey);
  if (Number.isFinite(numeric) && numeric > 0) {
    for (const preset of Object.values(KALTURA_OTT_PRESETS)) {
      if (preset.partnerId === numeric) return preset;
    }
    return buildGenericPreset(numeric);
  }
  return null;
}

function buildGenericPreset(partnerId: number): KalturaOttPartnerPreset {
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

export function mergePresetOverrides(
  preset: KalturaOttPartnerPreset,
  overrides: Record<string, unknown> | undefined,
): KalturaOttPartnerPreset {
  if (!overrides || typeof overrides !== "object") return preset;
  const o = overrides as Record<string, unknown>;
  const applicationName =
    typeof o.applicationName === "string" && o.applicationName.trim()
      ? o.applicationName.trim()
      : undefined;
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
    ...(applicationName
      ? {
          deviceConfig: {
            applicationName,
            clientVersion: preset.deviceConfig?.clientVersion || "1.0.0",
            platform: preset.deviceConfig?.platform || "STB",
            tag: preset.deviceConfig?.tag || "default",
          },
        }
      : {}),
  };
}
