import type { RequestClient } from "../../networking/request";
import type { KalturaOttPartnerPreset } from "./presets";

export interface KalturaOttSession {
  ks: string;
  sessionId: string | null;
  expiry: number | null;
}

export interface KalturaOttCredentials {
  username: string;
  password: string;
}

export class KalturaOttAuthenticationError extends Error {
  readonly code = "KALTURA_OTT_AUTHENTICATION_FAILED";
  readonly statusCode = 401;

  constructor(message = "Kaltura OTT authentication failed. Check the username and password.") {
    super(message);
    this.name = "KalturaOttAuthenticationError";
  }
}

export class KalturaOttSubscriptionRequiredError extends Error {
  readonly code = "KALTURA_OTT_SUBSCRIPTION_REQUIRED";
  readonly statusCode = 403;

  constructor(authenticated: boolean) {
    super(
      authenticated
        ? "This Kaltura OTT channel requires a subscription that is not available to the authenticated account."
        : "This Kaltura OTT channel requires a subscription. Supply a subscriber username and password.",
    );
    this.name = "KalturaOttSubscriptionRequiredError";
  }
}

export interface KalturaOttImage {
  url?: string;
  imageTypeName?: string;
  ratio?: string;
}

export interface KalturaOttMediaFile {
  type?: string;
  url?: string;
  id?: number;
}

export interface KalturaOttLiveAsset {
  id?: number;
  name?: string;
  description?: string;
  externalIds?: string;
  externalId?: string;
  externalEpgIngestId?: string;
  images?: KalturaOttImage[];
  mediaFiles?: KalturaOttMediaFile[];
  metas?: Record<string, { value?: number | string | boolean }>;
  objectType?: string;
}

export interface KalturaOttProgramAsset {
  id?: number;
  name?: string;
  description?: string;
  externalId?: string;
  epgChannelId?: number | string;
  linearAssetId?: number;
  startDate?: number;
  endDate?: number;
  images?: KalturaOttImage[];
  objectType?: string;
}

interface KalturaApiEnvelope<T> {
  result?: T;
  executionTime?: number;
}

interface KalturaListResponse {
  totalCount?: number;
  objects?: KalturaOttLiveAsset[];
}

interface KalturaProgramListResponse {
  totalCount?: number;
  objects?: KalturaOttProgramAsset[];
}

interface KalturaPlaybackSource {
  type?: string;
  url?: string;
  format?: string;
}

interface KalturaPlaybackContext {
  sources?: KalturaPlaybackSource[];
  error?: { message?: string; code?: string };
  messages?: Array<{ message?: string; code?: string; objectType?: string }>;
  actions?: Array<{ type?: string; objectType?: string }>;
}

const EPG_UNAVAILABLE = "המידע אינו זמין";

export class KalturaOttClient {
  private session: KalturaOttSession | null = null;

  constructor(
    private readonly request: RequestClient,
    private readonly preset: KalturaOttPartnerPreset,
    private readonly credentials?: KalturaOttCredentials,
  ) {}

  async ensureSession(): Promise<KalturaOttSession> {
    const now = Math.floor(Date.now() / 1000);
    if (this.session?.ks && this.session.expiry && this.session.expiry > now + 60) {
      return this.session;
    }

    if (this.preset.deviceConfig) {
      await this.serveByDevice();
    }

    const authenticated = Boolean(this.credentials);
    const serviceName = this.preset.apiVersion.startsWith("5.") ? "OTTUser" : "ottuser";
    const loginPath = authenticated
      ? `/api_v3/service/${serviceName}/action/login`
      : `/api_v3/service/${serviceName}/action/anonymousLogin`;

    const loginUrl = `${this.preset.apiHost}${loginPath}`;
    const body: Record<string, unknown> = {
      partnerId: this.preset.partnerId,
      udid: this.preset.udid,
      apiVersion: this.preset.apiVersion,
    };
    if (this.credentials) {
      body.username = this.credentials.username;
      body.password = this.credentials.password;
    }
    if (this.preset.apiVersion.startsWith("5.")) {
      body.clientTag = this.preset.clientTag;
    } else {
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

    const data = res.json<{
      result?: {
        ks?: string;
        expiry?: number;
        loginSession?: { ks?: string; expiry?: number };
        error?: { code?: string; message?: string };
      };
    }>();
    const result = data.result;
    if (result?.error) {
      if (authenticated) throw new KalturaOttAuthenticationError();
      throw new Error(
        `Kaltura OTT anonymous login failed${result.error.code ? ` (${result.error.code})` : ""}`,
      );
    }
    const ks = result?.loginSession?.ks || result?.ks;
    if (!ks) {
      if (authenticated) throw new KalturaOttAuthenticationError();
      throw new Error("Kaltura OTT login did not return ks");
    }

    const sessionHeader =
      headerValue(res.headers, "x-kaltura-session") ||
      headerValue(res.headers, "X-Kaltura-Session");

    this.session = {
      ks,
      sessionId: sessionHeader,
      expiry: result?.loginSession?.expiry ?? result?.expiry ?? null,
    };
    return this.session;
  }

  private async serveByDevice(): Promise<void> {
    const cfg = this.preset.deviceConfig;
    if (!cfg) return;
    const url = "https://api.frp1.ott.kaltura.com/api_v3/service/configurations/action/serveByDevice";
    const data = await this.request
      .json<{
        params?: {
          miniEPGCollectionId?: number | string;
          Gateways?: { JsonGW?: string; RestGW?: string };
        };
      }>(url, {
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
      })
      .catch(() => null);

    const params = data?.params;
    if (!params) return;
    const lineupId = Number(params.miniEPGCollectionId);
    if (Number.isFinite(lineupId) && lineupId > 0) {
      this.preset.defaultLineupId = lineupId;
      if (!this.preset.lineups.some(lineup => lineup.id === lineupId)) {
        this.preset.lineups.push({
          id: lineupId,
          title: `${this.preset.alias} channels`,
        });
      }
    }
    const gateway = params.Gateways?.JsonGW || params.Gateways?.RestGW;
    if (gateway) this.preset.apiHost = gateway.replace(/\/+$/, "");
  }

  private apiBase(): string {
    return this.preset.apiHost.replace(/\/+$/, "");
  }

  private async postApi<T>(path: string, payload: Record<string, unknown>): Promise<T> {
    const session = await this.ensureSession();
    const url = `${this.apiBase()}${path}`;
    return this.request.json<KalturaApiEnvelope<T>>(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": this.preset.userAgent,
      },
      body: JSON.stringify({ ...payload, ks: session.ks }),
    }).then(data => {
      if (!data.result) throw new Error(`Kaltura OTT empty response for ${path}`);
      return data.result;
    });
  }

  async listChannels(lineupId: number, pageSize = 500): Promise<KalturaOttLiveAsset[]> {
    const filter: Record<string, unknown> = {
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

    const payload: Record<string, unknown> = {
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

    const result = await this.postApi<KalturaListResponse>(
      "/api_v3/service/asset/action/list",
      payload,
    );
    return result.objects || [];
  }

  async getLiveAsset(assetId: number): Promise<KalturaOttLiveAsset> {
    const channels = await this.listChannels(this.preset.defaultLineupId, 1000);
    const found = channels.find(c => c.id === assetId);
    if (found) return found;

    const result = await this.postApi<KalturaListResponse>("/api_v3/service/asset/action/list", {
      filter: { objectType: "KalturaAssetFilter", idIn: String(assetId) },
      pager: { pageIndex: 1, pageSize: 1 },
      apiVersion: this.preset.apiVersion,
      clientTag: this.preset.clientTag,
      ignoreNull: true,
      format: 1,
    });
    const asset = result.objects?.[0];
    if (!asset) throw new Error(`Kaltura OTT live asset ${assetId} not found`);
    return asset;
  }

  async fetchEpgPrograms(
    channelRef: string,
    days: number,
    channelAssets?: KalturaOttLiveAsset[],
  ): Promise<KalturaOttProgramAsset[]> {
    if (this.preset.epgStyle === "cache") {
      return this.fetchEpgCache(channelRef, days);
    }
    return this.fetchEpgSearch(channelRef, days, channelAssets);
  }

  private async fetchEpgCache(channelAssetId: string, days: number): Promise<KalturaOttProgramAsset[]> {
    const session = await this.ensureSession();
    if (!this.preset.epgHost) {
      throw new Error("EPG cache host is not configured for this partner");
    }
    if (!session.sessionId) {
      throw new Error("Kaltura OTT EPG cache requires X-Kaltura-Session header from login");
    }

    const combined: KalturaOttProgramAsset[] = [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    for (let offset = 0; offset < days; offset++) {
      const day = new Date(today);
      day.setUTCDate(day.getUTCDate() + offset);
      const epoch = Math.floor(day.getTime() / 1000);
      const url =
        `${this.preset.epgHost}/api_v3/service/epg/action/get/date/${epoch}/slots/all` +
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
      const data = res.json<{ epgChunk?: Record<string, KalturaOttProgramAsset[]> }>();
      const chunk = data.epgChunk?.[channelAssetId] || [];
      combined.push(...chunk);
    }

    return filterEpgPrograms(combined, this.preset.epgUnavailableTitle);
  }

  private async fetchEpgSearch(
    channelRef: string,
    days: number,
    channelAssets?: KalturaOttLiveAsset[],
  ): Promise<KalturaOttProgramAsset[]> {
    let epgChannelId = channelRef;
    const numericRef = Number(channelRef);
    if (channelAssets?.length && Number.isFinite(numericRef)) {
      const byAsset = channelAssets.find(c => c.id === numericRef);
      if (byAsset?.externalIds) epgChannelId = byAsset.externalIds;
      else if (byAsset && !byAsset.externalIds && byAsset.externalId) {
        epgChannelId = byAsset.externalId;
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const end = now + days * 86400;
    const kSql = `(and epg_channel_id='${epgChannelId}' start_date>'${now - 3600}' end_date<'${end}' asset_type='epg')`;

    const result = await this.postApi<KalturaProgramListResponse>(
      "/api_v3/service/asset/action/list",
      {
        apiVersion: this.preset.apiVersion,
        clientTag: this.preset.clientTag,
        filter: {
          kSql,
          objectType: "KalturaSearchAssetFilter",
          orderBy: "START_DATE_ASC",
        },
        pager: { pageIndex: 1, pageSize: 1000 },
      },
    );

    return filterEpgPrograms(result.objects || [], this.preset.epgUnavailableTitle);
  }

  async getProgramPlayback(
    programId: number,
    context: "CATCHUP" | "START_OVER" | "PLAYBACK" = "CATCHUP",
  ): Promise<KalturaPlaybackSource[]> {
    const payload: Record<string, unknown> = {
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

    const result = await this.postApi<KalturaPlaybackContext>(
      "/api_v3/service/asset/action/getPlaybackContext",
      payload,
    );
    if (result.error) {
      throw new Error(result.error.message || "Playback not available");
    }
    return result.sources || [];
  }

  async getLivePlayback(assetId: number): Promise<KalturaPlaybackSource[]> {
    const result = await this.postApi<KalturaPlaybackContext>(
      "/api_v3/service/asset/action/getPlaybackContext",
      {
        apiVersion: this.preset.apiVersion,
        clientTag: this.preset.clientTag,
        ignoreNull: true,
        format: 1,
        assetId,
        assetType: "media",
        contextDataParams: {
          objectType: "KalturaPlaybackContextOptions",
          context: "PLAYBACK",
          streamerType: "applehttp",
        },
      },
    );

    const denied = result.messages?.find(message => message.code === "NotEntitled");
    const blocked = result.actions?.some(
      action =>
        action.type === "BLOCK" ||
        action.objectType === "KalturaAccessControlBlockAction",
    );
    if (denied || blocked) {
      throw new KalturaOttSubscriptionRequiredError(Boolean(this.credentials));
    }
    if (result.error) {
      throw new Error(result.error.message || "Kaltura OTT live playback is unavailable");
    }
    return result.sources || [];
  }

  async getProgramAsset(programId: number): Promise<KalturaOttProgramAsset> {
    const result = await this.postApi<KalturaListResponse>("/api_v3/service/asset/action/list", {
      filter: { objectType: "KalturaAssetFilter", idIn: String(programId) },
      pager: { pageIndex: 1, pageSize: 1 },
      apiVersion: this.preset.apiVersion,
      clientTag: this.preset.clientTag,
      ignoreNull: true,
      format: 1,
    });
    const asset = result.objects?.[0] as KalturaOttProgramAsset | undefined;
    if (!asset) throw new Error(`Kaltura OTT program ${programId} not found`);
    return asset;
  }
}

function filterEpgPrograms(
  programs: KalturaOttProgramAsset[],
  unavailableTitle?: string,
): KalturaOttProgramAsset[] {
  const skip = unavailableTitle || EPG_UNAVAILABLE;
  const seen = new Set<string>();
  const out: KalturaOttProgramAsset[] = [];
  for (const p of programs) {
    if (!p.id) continue;
    if (p.name === skip) continue;
    const key = `${p.id}:${p.startDate}:${p.endDate}:${p.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  out.sort((a, b) => (a.startDate || 0) - (b.startDate || 0));
  return out;
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | null {
  const direct = headers[name];
  if (typeof direct === "string") return direct;
  if (Array.isArray(direct) && direct[0]) return direct[0];
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) {
      if (typeof v === "string") return v;
      if (Array.isArray(v) && v[0]) return v[0];
    }
  }
  return null;
}

export function pickChannelLogo(images: KalturaOttImage[] | undefined): string | null {
  if (!images?.length) return null;
  const preferred = ["TVGuide_1x1", "16x9", "1x1"];
  for (const name of preferred) {
    const img = images.find(i => i.imageTypeName === name && i.url);
    if (img?.url) return img.url;
  }
  return images.find(i => i.url)?.url || null;
}

export function pickStreamFormats(files: KalturaOttMediaFile[] | undefined): {
  hls: string | null;
  dash: string | null;
} {
  let hls: string | null = null;
  let dash: string | null = null;
  for (const f of files || []) {
    if (!f.url) continue;
    const type = (f.type || "").toUpperCase();
    if (!hls && (type.includes("HLS") || f.url.includes(".m3u8"))) hls = f.url;
    if (!dash && (type.includes("DASH") || f.url.includes(".mpd"))) dash = f.url;
  }
  return { hls, dash };
}
