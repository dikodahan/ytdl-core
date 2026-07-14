import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  hlsFormat,
  progressiveFormat,
} from "../_shared/helpers";

const UUID_RE =
  "[\\da-zA-Z]{22}|[\\da-fA-F]{8}-[\\da-fA-F]{4}-[\\da-fA-F]{4}-[\\da-fA-F]{4}-[\\da-fA-F]{12}";

const VALID_URL = new RegExp(
  `^(?:peertube:(?<host>[^:]+):|https?:\\/\\/(?<host_2>[^/]+)\\/(?:videos\\/(?:watch|embed)|api\\/v\\d+\\/videos|w)\\/)(?<id>${UUID_RE})`,
  "i",
);

interface PeerTubeFile {
  fileUrl?: string;
  size?: number;
  fps?: number;
  resolution?: { label?: string; id?: number };
}

interface PeerTubePlaylist {
  playlistUrl?: string;
  files?: PeerTubeFile[];
}

interface PeerTubeVideo {
  name?: string;
  description?: string;
  duration?: number;
  thumbnailPath?: string;
  files?: PeerTubeFile[];
  streamingPlaylists?: PeerTubePlaylist[];
  account?: { displayName?: string; id?: number; url?: string };
  channel?: { displayName?: string; id?: number; url?: string };
  nsfw?: boolean;
}

function parseHeight(label?: string): number | null {
  if (!label) return null;
  const m = label.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

export class PeertubeIE extends InfoExtractor {
  static IE_NAME = "peertube";
  static IE_DESC = "PeerTube";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — progressive + HLS playlists`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const m = url.match(VALID_URL);
    if (!m?.groups?.id) throw new Error(`Could not extract id from URL: ${url}`);
    const host = m.groups.host || m.groups.host_2;
    const videoId = m.groups.id;
    if (!host) throw new Error(`Could not extract PeerTube host from URL: ${url}`);

    const video = await this.request.json<PeerTubeVideo>(
      `https://${host}/api/v1/videos/${videoId}`,
    );

    const formats: Format[] = [];
    const files: PeerTubeFile[] = [...(video.files || [])];

    for (const playlist of video.streamingPlaylists || []) {
      if (playlist.playlistUrl) {
        formats.push(hlsFormat(playlist.playlistUrl, "hls"));
      }
      if (Array.isArray(playlist.files)) files.push(...playlist.files);
    }

    for (const file of files) {
      if (!file.fileUrl) continue;
      const formatId = file.resolution?.label || "http";
      formats.push(
        progressiveFormat(file.fileUrl, {
          format_id: formatId,
          filesize: file.size ?? null,
          height: parseHeight(formatId),
          has_video: formatId !== "0p",
          vcodec: formatId === "0p" ? "none" : "unknown",
        }),
      );
    }

    if (!formats.length) throw new Error(`No playable formats for PeerTube ${videoId}`);

    const webpageUrl = `https://${host}/videos/watch/${videoId}`;
    const thumbPath = video.thumbnailPath;
    const thumbnail = thumbPath
      ? thumbPath.startsWith("http")
        ? thumbPath
        : new URL(thumbPath, webpageUrl).toString()
      : undefined;

    return baseInfo("peertube", url, {
      id: videoId,
      title: video.name || videoId,
      description: video.description || null,
      uploader: video.account?.displayName || null,
      uploader_id: video.account?.id != null ? String(video.account.id) : null,
      duration: video.duration ?? null,
      thumbnail,
      formats,
    });
  }
}
