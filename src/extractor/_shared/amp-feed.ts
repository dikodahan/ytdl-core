import type { Format } from "../../core/types";
import { hlsFormat, progressiveFormat, tryParseJson } from "./helpers";

type Attrs = Record<string, string | undefined>;

interface AmpNode {
  "@attributes"?: Attrs;
  "media-category"?: { "@attributes"?: Attrs };
  [key: string]: unknown;
}

interface AmpFeed {
  channel?: {
    item?: Record<string, unknown> & {
      guid?: string;
      pubDate?: string;
      "dc-date"?: string;
      "media-group"?: Record<string, unknown>;
    };
  };
  error?: string;
}

function stripJsonp(text: string): string {
  const trimmed = text.trim();
  const open = trimmed.indexOf("(");
  const close = trimmed.lastIndexOf(")");
  if (open >= 0 && close > open) return trimmed.slice(open + 1, close);
  return trimmed;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getMediaNode(item: Record<string, unknown>, name: string): unknown {
  const mediaName = `media-${name}`;
  const group = item["media-group"];
  const mediaGroup =
    group && typeof group === "object" && !Array.isArray(group)
      ? (group as Record<string, unknown>)
      : null;
  return (
    mediaGroup?.[mediaName] ??
    item[mediaName] ??
    item[name] ??
    null
  );
}

function parseTimestamp(pubDate?: string, isoDate?: string): number | null {
  if (isoDate) {
    const t = Date.parse(isoDate);
    if (Number.isFinite(t)) return Math.floor(t / 1000);
  }
  if (pubDate) {
    const t = Date.parse(pubDate);
    if (Number.isFinite(t)) return Math.floor(t / 1000);
  }
  return null;
}

function extFromType(type?: string, url?: string): string {
  if (type?.includes("mpegURL") || type?.includes("m3u8")) return "m3u8";
  if (type?.includes("mp4")) return "mp4";
  if (url?.includes(".m3u8")) return "m3u8";
  const m = url?.split("?")[0]?.match(/\.([a-z0-9]{2,5})$/i);
  return m?.[1]?.toLowerCase() || "mp4";
}

export interface AmpFeedInfo {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  duration: number | null;
  timestamp: number | null;
  formats: Format[];
}

/** Parse Akamai Adaptive Media Player JSONP feed (yt-dlp AMPIE). */
export function parseAmpFeed(raw: string, videoId: string): AmpFeedInfo {
  const feed = tryParseJson<AmpFeed>(stripJsonp(raw));
  const item = feed?.channel?.item;
  if (!item) {
    throw new Error(`foxnews: ${feed?.error || "Akamai AMP feed missing channel.item"}`);
  }

  const id = String(item.guid || videoId);
  const title = String(getMediaNode(item, "title") || item.title || id);
  const description = String(getMediaNode(item, "description") || item.description || "") || null;

  let thumbnail: string | null = null;
  for (const thumb of asArray<AmpNode>(getMediaNode(item, "thumbnail") as AmpNode | AmpNode[])) {
    const url = thumb["@attributes"]?.url;
    if (url) {
      thumbnail = url.startsWith("//") ? `https:${url}` : url;
      break;
    }
  }

  const formats: Format[] = [];
  let duration: number | null = null;

  for (const mediaData of asArray<AmpNode>(getMediaNode(item, "content") as AmpNode | AmpNode[])) {
    const media = mediaData["@attributes"] || {};
    const mediaUrl = media.url;
    if (!mediaUrl) continue;

    const label =
      mediaData["media-category"]?.["@attributes"]?.label ||
      media.type ||
      "http";
    const dur = media.duration ? Number(media.duration) : null;
    if (dur && Number.isFinite(dur)) duration = dur;

    const ext = extFromType(media.type, mediaUrl);
    const url = mediaUrl.startsWith("//") ? `https:${mediaUrl}` : mediaUrl;

    if (ext === "m3u8") {
      formats.push(hlsFormat(url, String(label).toLowerCase().replace(/\W+/g, "_") || "hls"));
    } else if (ext === "f4m") {
      // Flash/HDS — skip (VLC-oriented path prefers HLS/MP4)
      continue;
    } else {
      formats.push(
        progressiveFormat(url, {
          format_id: String(label),
          tbr: media.bitrate ? Number(media.bitrate) : null,
          filesize: media.fileSize ? Number(media.fileSize) : null,
          ext,
        }),
      );
    }
  }

  if (!formats.length) {
    throw new Error(`foxnews: no playable formats in AMP feed for ${id}`);
  }

  return {
    id,
    title,
    description,
    thumbnail,
    duration,
    timestamp: parseTimestamp(item.pubDate, item["dc-date"]),
    formats,
  };
}
