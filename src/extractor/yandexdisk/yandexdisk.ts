import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  hlsFormat,
  progressiveFormat,
  tryParseJson,
} from "../_shared/helpers";

const VALID_URL =
  /https?:\/\/(?<domain>yadi\.sk|disk\.(?:360\.)?yandex\.(?:az|by|com(?:\.(?:am|ge|tr))?|co\.il|ee|fr|k[gz]|l[tv]|md|t[jm]|u[az]|ru))\/(?:[di]\/?|public.*?\bhash=)(?<id>[^/?#&]+)/i;

interface YandexResource {
  name?: string;
  hash?: string;
  uid?: string;
  meta?: {
    short_url?: string;
    ext?: string;
    mime_type?: string;
    size?: number;
    views_counter?: number;
  };
  videoStreams?: {
    duration?: number;
    videos?: Array<{
      url?: string;
      dimension?: string;
      size?: { width?: number; height?: number };
    }>;
  };
}

interface YandexStore {
  resources?: Record<string, YandexResource>;
  rootResourceId?: string;
  environment?: { sk?: string; yandexuid?: string };
  users?: Record<string, { displayName?: string }>;
}

function mimeExt(mime?: string): string | undefined {
  if (!mime) return undefined;
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return mime.split("/")[1]?.split(";")[0];
}

export class YandexDiskIE extends InfoExtractor {
  static IE_NAME = "yandexdisk";
  static IE_DESC = "Yandex Disk";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — source + HLS`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const m = url.match(VALID_URL);
    if (!m?.groups?.id) throw new Error(`Could not extract id from URL: ${url}`);
    let videoId = m.groups.id;
    const domain = m.groups.domain;

    const webpage = await this.request.text(url);
    const storeRaw = webpage.match(
      /<script[^>]+id=["']store-prefetch["'][^>]*>\s*(\{[\s\S]+?\})\s*<\/script>/i,
    )?.[1];
    const store = storeRaw ? tryParseJson<YandexStore>(storeRaw) : null;
    if (!store?.resources || !store.rootResourceId) {
      throw new Error(`Could not parse Yandex Disk store for ${videoId}`);
    }

    const resource = store.resources[store.rootResourceId];
    if (!resource) throw new Error(`Yandex Disk resource missing for ${videoId}`);

    const title = resource.name || videoId;
    const meta = resource.meta || {};
    if (meta.short_url) {
      const shortId = meta.short_url.match(VALID_URL)?.groups?.id;
      if (shortId) videoId = shortId;
    }

    let sourceUrl: string | undefined;
    try {
      const dl = await this.request.json<{ href?: string }>(
        "https://cloud-api.yandex.net/v1/disk/public/resources/download",
        { query: { public_key: url } },
      );
      sourceUrl = dl.href;
    } catch {
      /* fall through to public API */
    }

    let videoStreams = resource.videoStreams || {};
    const videoHash = resource.hash || url;
    const sk = store.environment?.sk;
    const yandexuid = store.environment?.yandexuid;

    if (sk && yandexuid && (!sourceUrl || !videoStreams.videos?.length)) {
      this.request.agent.jar.setCookieSync(
        `yandexuid=${yandexuid}; Path=/; Domain=${domain.startsWith("disk.") ? domain : `.${domain}`}`,
        `https://${domain}/`,
      );

      const callApi = async (action: string): Promise<Record<string, unknown>> => {
        try {
          const resp = await this.request.json<{ data?: Record<string, unknown> }>(
            new URL(`/public/api/${action}`, url).toString(),
            {
              method: "POST",
              headers: { "Content-Type": "text/plain" },
              body: JSON.stringify({ hash: videoHash, sk }),
            },
          );
          return resp.data || {};
        } catch {
          return {};
        }
      };

      if (!sourceUrl) {
        const data = await callApi("download-url");
        if (typeof data.url === "string") sourceUrl = data.url;
      }
      if (!videoStreams.videos?.length) {
        videoStreams = (await callApi("get-video-streams")) as typeof videoStreams;
      }
    }

    const formats: Format[] = [];
    if (sourceUrl) {
      formats.push(
        progressiveFormat(sourceUrl, {
          format_id: "source",
          ext: title.split(".").pop()?.toLowerCase() || meta.ext || mimeExt(meta.mime_type) || "mp4",
          quality: 1,
          filesize: meta.size ?? null,
        }),
      );
    }

    for (const video of videoStreams.videos || []) {
      if (!video.url) continue;
      if (video.dimension === "adaptive") {
        formats.push(hlsFormat(video.url, "hls"));
      } else {
        const height = video.size?.height ?? null;
        formats.push(
          progressiveFormat(video.url, {
            format_id: height ? `hls-${height}p` : "hls",
            ext: "mp4",
            protocol: "m3u8_native",
            isHLS: true,
            width: video.size?.width ?? null,
            height,
          }),
        );
      }
    }

    if (!formats.length) throw new Error(`No playable formats for Yandex Disk ${videoId}`);

    const uid = resource.uid;
    const displayName = uid ? store.users?.[uid]?.displayName : undefined;
    const durationMs = videoStreams.duration;

    return baseInfo(YandexDiskIE.IE_NAME, url, {
      id: videoId,
      title,
      duration: durationMs != null ? durationMs / 1000 : null,
      uploader: displayName || null,
      uploader_id: uid || null,
      view_count: meta.views_counter ?? null,
      formats,
    });
  }
}
