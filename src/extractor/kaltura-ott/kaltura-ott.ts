import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { CategoryListResult } from "../../core/category-list";
import type { ListVideosOptions, VideoListResult } from "../../core/video-list";
import type { Format, InfoDict } from "../../core/types";
import type { CategoryListEntry } from "../_shared/page-links";
import { baseInfo, dashFormat, hlsFormat } from "../_shared/helpers";
import {
  KalturaOttClient,
  KalturaOttAuthenticationError,
  pickChannelLogo,
  type KalturaOttCredentials,
  type KalturaOttLiveAsset,
  type KalturaOttProgramAsset,
} from "./client";
import {
  KALTURA_OTT_PRESETS,
  mergePresetOverrides,
  resolvePartnerPreset,
  type KalturaOttPartnerPreset,
} from "./presets";

/** Pseudo-URL scheme for Kaltura OTT TV (live channels, EPG, catch-up). */
const VALID_URL =
  /^kaltura-ott:(?<partner>\w+)(?::(?<kind>categories|channels|lineup|live|epg|program)(?::(?<id>\d+))?)?(?:\?(?<query>[^#]*))?$/i;

const LIST_KINDS = new Set(["categories", "channels", "lineup", "epg"]);
const EXTRACT_KINDS = new Set(["live", "program"]);

type OttKind = "categories" | "channels" | "lineup" | "live" | "epg" | "program" | "root";

interface ParsedOttUrl {
  partnerKey: string;
  kind: OttKind;
  id?: string;
  query: URLSearchParams;
  raw: string;
}

function parseOttUrl(url: string): ParsedOttUrl {
  const m = url.match(VALID_URL);
  if (!m?.groups?.partner) throw new Error(`Invalid Kaltura OTT URL: ${url}`);
  const kind = (m.groups.kind || "root") as OttKind;
  return {
    partnerKey: m.groups.partner,
    kind,
    id: m.groups.id,
    query: new URLSearchParams(m.groups.query || ""),
    raw: url,
  };
}

function pageUrl(partner: string, kind: string, id?: string, query?: URLSearchParams): string {
  const q = query?.toString();
  const base = id ? `kaltura-ott:${partner}:${kind}:${id}` : `kaltura-ott:${partner}:${kind}`;
  return q ? `${base}?${q}` : base;
}

export class KalturaOttIE extends InfoExtractor {
  static IE_NAME = "kaltura-ott";
  static IE_DESC = "Kaltura OTT TV — live channels, EPG, and catch-up playback";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
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
          key: "username",
          label: "Subscriber username",
          type: "string",
          description: "Optional provider username for subscription-protected channels",
          default: "",
        },
        {
          key: "password",
          label: "Subscriber password",
          type: "password",
          description: "Optional provider password; sent only for this request",
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
      notes:
        "Use pseudo-URLs like `kaltura-ott:reshet:live:2605018` or `kaltura-ott:cellcom:epg:3728`. Built-in presets: reshet (5031), cellcom (3197).",
      listSupported: true,
    };
  }

  static suitable(url: string): boolean {
    if (!VALID_URL.test(url)) return false;
    try {
      const { kind } = parseOttUrl(url);
      return EXTRACT_KINDS.has(kind);
    } catch {
      return false;
    }
  }

  static listUrlSupported(url: string): boolean {
    if (!VALID_URL.test(url)) return false;
    const { kind } = parseOttUrl(url);
    if (kind === "root") return true;
    return LIST_KINDS.has(kind);
  }

  private resolvePreset(partnerKey: string): KalturaOttPartnerPreset {
    const base = resolvePartnerPreset(partnerKey);
    if (!base) {
      throw new Error(
        `Unknown Kaltura OTT partner "${partnerKey}". Use reshet, cellcom, or a numeric partner id.`,
      );
    }
    const overrides = this.params.extractorArgs?.kalturaOtt as Record<string, unknown> | undefined;
    return mergePresetOverrides(base, overrides);
  }

  private client(preset: KalturaOttPartnerPreset): KalturaOttClient {
    return new KalturaOttClient(this.request, preset, this.credentials());
  }

  private credentials(): KalturaOttCredentials | undefined {
    const args = this.params.extractorArgs?.kalturaOtt as Record<string, unknown> | undefined;
    const username = typeof args?.username === "string" ? args.username.trim() : "";
    const password = typeof args?.password === "string" ? args.password : "";
    if (!username && !password) return undefined;
    if (!username || !password) {
      throw new KalturaOttAuthenticationError(
        "Kaltura OTT username and password must both be supplied.",
      );
    }
    return { username, password };
  }

  private epgDays(parsed: ParsedOttUrl, preset: KalturaOttPartnerPreset): number {
    const fromQuery = Number(parsed.query.get("days"));
    if (Number.isFinite(fromQuery) && fromQuery > 0) return Math.min(Math.floor(fromQuery), 14);
    const fromArgs = Number(this.params.extractorArgs?.kalturaOttDays);
    if (Number.isFinite(fromArgs) && fromArgs > 0) return Math.min(Math.floor(fromArgs), 14);
    return preset.defaultEpgDays;
  }

  async extract(url: string): Promise<InfoDict> {
    const parsed = parseOttUrl(url);
    if (!EXTRACT_KINDS.has(parsed.kind)) {
      throw new Error(
        `kaltura-ott: use :live:{assetId} or :program:{assetId} for extraction (got ${parsed.kind})`,
      );
    }
    if (!parsed.id) throw new Error(`kaltura-ott: missing asset id in URL: ${url}`);

    const preset = this.resolvePreset(parsed.partnerKey);
    const client = this.client(preset);
    const assetId = Number(parsed.id);

    if (parsed.kind === "live") {
      return this.extractLive(url, parsed, preset, client, assetId);
    }
    return this.extractProgram(url, parsed, preset, client, assetId);
  }

  private async extractLive(
    url: string,
    parsed: ParsedOttUrl,
    preset: KalturaOttPartnerPreset,
    client: KalturaOttClient,
    assetId: number,
  ): Promise<InfoDict> {
    const asset = await client.getLiveAsset(assetId);
    const sources = await client.getLivePlayback(assetId);
    const formats: Format[] = [];
    for (const source of sources) {
      if (!source.url) continue;
      const type = (source.type || source.format || "").toUpperCase();
      if (type.includes("DASH") || source.url.includes(".mpd")) {
        formats.push(dashFormat(source.url, `dash-${formats.length + 1}`));
      } else {
        formats.push(hlsFormat(source.url, `hls-${formats.length + 1}`));
      }
    }
    if (!formats.length) {
      throw new Error(`Kaltura OTT live asset ${assetId} has no playable streams`);
    }

    const channelNum = asset.metas?.ChannelNumber?.value;
    if (channelNum != null && formats[0]) {
      formats[0].format_note = `Channel ${channelNum}`;
    }

    return baseInfo(KalturaOttIE.IE_NAME, url, {
      id: String(assetId),
      display_id: asset.externalIds || asset.externalId || String(assetId),
      title: asset.name || `Channel ${assetId}`,
      description: asset.description || null,
      thumbnail: pickChannelLogo(asset.images),
      live_status: "is_live",
      uploader: preset.alias,
      formats,
    });
  }

  private async extractProgram(
    url: string,
    parsed: ParsedOttUrl,
    preset: KalturaOttPartnerPreset,
    client: KalturaOttClient,
    programId: number,
  ): Promise<InfoDict> {
    let program: KalturaOttProgramAsset | null = null;
    let sources: Awaited<ReturnType<KalturaOttClient["getProgramPlayback"]>> = [];
    let playbackNote: string | null = null;

    for (const ctx of ["CATCHUP", "START_OVER", "PLAYBACK"] as const) {
      try {
        sources = await client.getProgramPlayback(programId, ctx);
        if (sources.length) break;
      } catch {
        /* try next context */
      }
    }

    try {
      program = await client.getProgramAsset(programId);
    } catch {
      program = null;
    }

    const formats: Format[] = [];
    for (const src of sources) {
      if (!src.url) continue;
      const type = (src.type || src.format || "").toUpperCase();
      if (type.includes("HLS") || src.url.includes(".m3u8")) {
        formats.push(hlsFormat(src.url, `hls-${formats.length + 1}`));
      } else if (type.includes("DASH") || src.url.includes(".mpd")) {
        formats.push(dashFormat(src.url, `dash-${formats.length + 1}`));
      } else {
        formats.push(hlsFormat(src.url, `stream-${formats.length + 1}`));
      }
    }

    if (!formats.length && program?.linearAssetId) {
      playbackNote =
        "Catch-up playback unavailable with anonymous session; falling back to parent live channel stream.";
      try {
        const live = await this.extractLive(
          pageUrl(parsed.partnerKey, "live", String(program.linearAssetId)),
          { ...parsed, kind: "live", id: String(program.linearAssetId) },
          preset,
          client,
          program.linearAssetId,
        );
        return {
          ...live,
          id: String(programId),
          display_id: program.externalId || String(programId),
          title: program.name || live.title,
          description: [program.description, playbackNote].filter(Boolean).join(" "),
          thumbnail: pickChannelLogo(program.images) || live.thumbnail,
          live_status: program.endDate && program.endDate < Date.now() / 1000 ? "was_live" : "is_live",
          timestamp: program.startDate ?? null,
          duration:
            program.startDate && program.endDate
              ? Math.max(0, program.endDate - program.startDate)
              : null,
          webpage_url: url,
          original_url: url,
        };
      } catch {
        /* fall through */
      }
    }

    if (!formats.length) {
      throw new Error(
        `Kaltura OTT program ${programId} has no playable streams (catch-up may require subscription)`,
      );
    }

    return baseInfo(KalturaOttIE.IE_NAME, url, {
      id: String(programId),
      display_id: program?.externalId || String(programId),
      title: program?.name || `Program ${programId}`,
      description: program?.description || playbackNote,
      thumbnail: pickChannelLogo(program?.images),
      timestamp: program?.startDate ?? null,
      duration:
        program?.startDate && program?.endDate
          ? Math.max(0, program.endDate - program.startDate)
          : null,
      formats,
    });
  }

  async listVideos(url: string, options: ListVideosOptions = {}): Promise<VideoListResult> {
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
      let channelAssets: KalturaOttLiveAsset[] | undefined;
      if (preset.epgStyle === "search") {
        channelAssets = await client.listChannels(preset.defaultLineupId);
      }
      const programs = await client.fetchEpgPrograms(parsed.id, days, channelAssets);
      let entries = programs.map(p => programListEntry(partner, p, parsed.query));
      if (options.limit && options.limit > 0) entries = entries.slice(0, options.limit);

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
    if (options.limit && options.limit > 0) entries = entries.slice(0, options.limit);

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

  async listCategories(
    url?: string,
    options: { limit?: number } = {},
  ): Promise<CategoryListResult> {
    const parsed = parseOttUrl(url?.trim() || "kaltura-ott:reshet:categories");
    const preset = this.resolvePreset(parsed.partnerKey);
    const partner = preset.alias;

    let entries: CategoryListEntry[] = preset.lineups.map(lineup => ({
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

function resolveLineupId(parsed: ParsedOttUrl, preset: KalturaOttPartnerPreset): number {
  if (parsed.kind === "lineup" && parsed.id) return Number(parsed.id);
  if (parsed.query.get("lineup")) return Number(parsed.query.get("lineup"));
  if (preset.defaultLineupId) return preset.defaultLineupId;
  throw new Error("No lineup id configured for this Kaltura OTT partner");
}

function channelListEntry(partner: string, asset: KalturaOttLiveAsset) {
  const id = String(asset.id);
  return {
    id,
    display_id: asset.externalIds || asset.externalId || id,
    title: asset.name || id,
    thumbnail: pickChannelLogo(asset.images),
    url: pageUrl(partner, "live", id),
  };
}

function programListEntry(
  partner: string,
  program: KalturaOttProgramAsset,
  query: URLSearchParams,
) {
  const id = String(program.id);
  const q = new URLSearchParams(query);
  return {
    id,
    display_id: program.externalId || id,
    title: program.name || id,
    thumbnail: pickChannelLogo(program.images),
    url: pageUrl(partner, "program", id, q),
  };
}

export { KALTURA_OTT_PRESETS, resolvePartnerPreset };
