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
export declare const KALTURA_OTT_PRESETS: Record<string, KalturaOttPartnerPreset>;
export declare function resolvePartnerPreset(partnerKey: string): KalturaOttPartnerPreset | null;
export declare function mergePresetOverrides(preset: KalturaOttPartnerPreset, overrides: Record<string, unknown> | undefined): KalturaOttPartnerPreset;
//# sourceMappingURL=presets.d.ts.map