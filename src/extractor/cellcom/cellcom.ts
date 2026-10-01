import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { CategoryListResult } from "../../core/category-list";
import type { ListVideosOptions, VideoListResult } from "../../core/video-list";
import type { InfoDict, YoutubeDLParams } from "../../core/types";
import { KalturaOttIE } from "../kaltura-ott/kaltura-ott";

/**
 * Cellcom TV — dedicated Stream Lab provider over Kaltura OTT partner 3197.
 *
 * Pseudo-URLs:
 * - `cellcom:channels` / `cellcom:categories`
 * - `cellcom:live:{assetId}`
 * - `cellcom:epg:{epgChannelId}`
 * - `cellcom:program:{programId}`
 */
const VALID_URL =
  /^cellcom(?::(?<kind>categories|channels|lineup|live|epg|program)(?::(?<id>\d+))?)?(?:\?(?<query>[^#]*))?$/i;

const LIST_KINDS = new Set(["categories", "channels", "lineup", "epg", "root"]);
const EXTRACT_KINDS = new Set(["live", "program"]);

function parseKind(url: string): string {
  const m = url.match(VALID_URL);
  return (m?.groups?.kind || "root").toLowerCase();
}

function toKalturaOttUrl(url: string): string {
  const trimmed = url.trim();
  if (/^kaltura-ott:/i.test(trimmed)) return trimmed;
  const m = trimmed.match(VALID_URL);
  if (!m) throw new Error(`Invalid Cellcom URL: ${url}`);
  const kind = m.groups?.kind;
  const id = m.groups?.id;
  const query = m.groups?.query;
  let path = "kaltura-ott:cellcom";
  if (kind) path += `:${kind}`;
  if (id) path += `:${id}`;
  return query ? `${path}?${query}` : kind ? path : `${path}:channels`;
}

export class CellcomIE extends InfoExtractor {
  static IE_NAME = "cellcom";
  static IE_DESC = "Cellcom TV — Kaltura OTT live channels, EPG, and catch-up";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: CellcomIE.IE_NAME,
      description: `${CellcomIE.IE_DESC} (partner 3197 / com.cellcom.cellcomtv)`,
      validUrl: String(CellcomIE._VALID_URL),
      options: [
        {
          key: "username",
          label: "Subscriber username",
          type: "string",
          description: "Optional Cellcom username for subscription-protected channels",
          default: "",
        },
        {
          key: "password",
          label: "Subscriber password",
          type: "password",
          description: "Optional Cellcom password; sent only for this request",
          default: "",
        },
        {
          key: "days",
          label: "EPG days",
          type: "number",
          description: "Days of EPG to fetch when listing or extracting programs",
          default: 3,
        },
        {
          key: "forceAndroidTv",
          label: "Force Android TV",
          type: "boolean",
          description:
            "Use the Android TV / STB device profile (platform=STB) instead of the default mobile Android profile when listing channels.",
          default: false,
        },
      ],
      notes:
        "List with `cellcom:channels`. Extract with `cellcom:live:{id}`. Check Force Android TV when the TV app lineup differs from mobile.",
      listSupported: true,
    };
  }

  static suitable(url: string): boolean {
    if (!VALID_URL.test(url)) return false;
    return EXTRACT_KINDS.has(parseKind(url));
  }

  static listUrlSupported(url: string): boolean {
    if (!VALID_URL.test(url)) return false;
    return LIST_KINDS.has(parseKind(url));
  }

  private delegate(): KalturaOttIE {
    const extractorArgs: Record<string, unknown> = {
      ...(this.params.extractorArgs || {}),
    };
    const fromCellcom =
      extractorArgs.cellcom && typeof extractorArgs.cellcom === "object"
        ? (extractorArgs.cellcom as Record<string, unknown>)
        : {};
    const fromKaltura =
      extractorArgs.kalturaOtt && typeof extractorArgs.kalturaOtt === "object"
        ? (extractorArgs.kalturaOtt as Record<string, unknown>)
        : {};

    extractorArgs.kalturaOtt = {
      ...fromKaltura,
      ...fromCellcom,
      applicationName:
        (typeof fromCellcom.applicationName === "string" &&
          fromCellcom.applicationName.trim()) ||
        (typeof fromKaltura.applicationName === "string" &&
          fromKaltura.applicationName.trim()) ||
        "com.cellcom.cellcomtv",
      forceAndroidTv:
        extractorArgs.forceAndroidTv ??
        fromCellcom.forceAndroidTv ??
        fromKaltura.forceAndroidTv,
      platform: fromCellcom.platform ?? fromKaltura.platform ?? extractorArgs.platform,
      username: fromCellcom.username ?? fromKaltura.username ?? extractorArgs.username,
      password: fromCellcom.password ?? fromKaltura.password ?? extractorArgs.password,
    };

    const params: YoutubeDLParams = {
      ...this.params,
      extractorArgs,
    };
    return new KalturaOttIE(params, this.request);
  }

  async extract(url: string): Promise<InfoDict> {
    const info = await this.delegate().extract(toKalturaOttUrl(url));
    return {
      ...info,
      extractor: CellcomIE.IE_NAME,
      webpage_url: url,
      original_url: url,
    };
  }

  async listVideos(url: string, options: ListVideosOptions = {}): Promise<VideoListResult> {
    const target = url.trim() && VALID_URL.test(url.trim()) ? url.trim() : "cellcom:channels";
    const result = await this.delegate().listVideos(toKalturaOttUrl(target), options);
    return {
      ...result,
      extractor: CellcomIE.IE_NAME,
      webpage_url: target.startsWith("cellcom") ? target : "cellcom:channels",
    };
  }

  async listCategories(
    url?: string,
    options: { limit?: number } = {},
  ): Promise<CategoryListResult> {
    const target =
      url?.trim() && VALID_URL.test(url.trim()) ? url.trim() : "cellcom:categories";
    const result = await this.delegate().listCategories(toKalturaOttUrl(target), options);
    return {
      ...result,
      extractor: CellcomIE.IE_NAME,
      webpage_url: target,
    };
  }
}
