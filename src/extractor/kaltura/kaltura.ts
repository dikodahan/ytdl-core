import { InfoExtractor } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  hlsFormat,
  progressiveFormat,
} from "../_shared/helpers";

interface KalturaFlavor {
  id?: string;
  status?: number;
  fileExt?: string;
  bitrate?: number;
  height?: number;
  width?: number;
  size?: number;
  frameRate?: number;
  containerFormat?: string;
  videoCodecId?: string;
  isOriginal?: boolean;
}

interface KalturaEntry {
  id?: string;
  name?: string;
  description?: string;
  dataUrl?: string;
  duration?: number;
  thumbnailUrl?: string;
  createdAt?: number;
  userId?: string;
  plays?: number;
}

const SERVICE_URL = "https://cdnapi.kaltura.com";
const SERVICE_BASE = "/api_v3/service/multirequest";

export class KalturaIE extends InfoExtractor {
  static IE_NAME = "kaltura";
  static IE_DESC = "Kaltura embeds / partner entries";
  static readonly _VALID_URL =
    /(?:kaltura:(?<partner_id>\w+):(?<id>\w+)|https?:\/\/(?:(?:www|cdnapi(?:sec)?)\.)?kaltura\.com(?::\d+)?\/(?:index\.php\/(?:kwidget|extwidget\/preview)|html5\/html5lib\/[^/]+\/mwEmbedFrame\.php)(?:\/(?<path>[^?]+))?(?:\?(?<query>.*))?)/i;

  async extract(url: string): Promise<InfoDict> {
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

    const params: Record<string, unknown> = { ...(actions[0] as object) };
    actions.slice(1).forEach((a, i) => {
      params[String(i + 1)] = a;
    });

    const data = await this.request.json<unknown[]>(SERVICE_URL + SERVICE_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    for (const [idx, status] of data.entries()) {
      if (
        status &&
        typeof status === "object" &&
        (status as { objectType?: string }).objectType === "KalturaAPIException"
      ) {
        const msg = (status as { message?: string }).message || "Kaltura API error";
        throw new Error(`kaltura said: ${msg} (${idx})`);
      }
    }

    const infoList = data[2] as { objects?: KalturaEntry[] } | KalturaEntry | undefined;
    const info: KalturaEntry =
      infoList && typeof infoList === "object" && "objects" in infoList
        ? infoList.objects?.[0] || {}
        : (infoList as KalturaEntry) || {};
    const flavorAssets = (data[3] as KalturaFlavor[]) || [];

    const dataUrl = info.dataUrl || "";
    const formats: Format[] = [];

    for (const f of flavorAssets) {
      if (f.status != null && f.status !== 2) continue;
      if (f.fileExt === "chun" || f.fileExt === "wvm") continue;
      const ext = f.fileExt || (f.containerFormat === "qt" ? "mov" : "mp4");
      if (!f.id || !dataUrl) continue;
      const videoUrl = `${dataUrl.replace(/\/flvclipper\/.*/, "/serveFlavor")}/flavorId/${f.id}`;
      const isAudio = !f.videoCodecId && f.frameRate === 0;
      formats.push(
        progressiveFormat(videoUrl, {
          format_id: `${ext}-${f.bitrate || "0"}`,
          ext,
          width: f.width ?? null,
          height: f.height ?? null,
          tbr: f.bitrate ?? null,
          filesize: f.size ?? null,
          has_video: !isAudio,
          vcodec: isAudio ? "none" : f.videoCodecId || "unknown",
        }),
      );
    }

    if (dataUrl.includes("/playManifest/")) {
      const m3u8 = dataUrl.replace("format/url", "format/applehttp");
      formats.push(hlsFormat(m3u8));
    }

    if (!formats.length) {
      throw new Error(`Kaltura entry ${entryId} has no playable formats`);
    }

    return baseInfo(KalturaIE.IE_NAME, url, {
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

  private parseIds(url: string): { partnerId: string; entryId: string } {
    const m = url.match(KalturaIE._VALID_URL);
    if (!m) throw new Error(`Could not parse Kaltura URL: ${url}`);

    if (m.groups?.partner_id && m.groups?.id) {
      return { partnerId: m.groups.partner_id, entryId: m.groups.id };
    }

    const params: Record<string, string> = {};
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

    let partnerId =
      params.partner_id ||
      params.p ||
      (params.wid ? params.wid.replace(/^_/, "") : "");
    const entryId = params.entry_id || params.entryId;

    if (!partnerId || !entryId) {
      throw new Error(`Could not extract Kaltura partner/entry from URL: ${url}`);
    }
    return { partnerId, entryId };
  }
}
