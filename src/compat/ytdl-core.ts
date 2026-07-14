import { PassThrough, type Readable } from "stream";
import { YoutubeDL } from "../core/youtube-dl";
import { chooseFormat as coreChooseFormat, filterFormats as coreFilterFormats } from "../core/format-select";
import type { Format, InfoDict, YoutubeDLParams } from "../core/types";
import { createAgent, createProxyAgent, type CompatCookie } from "../networking/request";
import { downloadFormat } from "../downloader/http";
import {
  getURLVideoID,
  getVideoID,
  validateID,
  validateURL,
} from "../extractor/youtube/base";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require("../../package.json") as { version: string };

type Filter =
  | "audioandvideo"
  | "videoandaudio"
  | "video"
  | "videoonly"
  | "audio"
  | "audioonly"
  | ((format: CompatFormat) => boolean);

interface CompatFormat extends Format {
  hasAudio?: boolean;
  hasVideo?: boolean;
  container?: string;
  codecs?: string;
  videoCodec?: string;
  audioCodec?: string;
  isLive?: boolean;
}

interface VideoDetails {
  videoId: string;
  title: string;
  lengthSeconds: string;
  keywords?: string[];
  channelId?: string;
  isOwnerViewing?: boolean;
  shortDescription?: string;
  isCrawlable?: boolean;
  thumbnail?: { thumbnails: Array<{ url: string; width?: number; height?: number }> };
  averageRating?: number;
  allowRatings?: boolean;
  viewCount?: string;
  author?: string;
  isPrivate?: boolean;
  isUnpluggedCorpus?: boolean;
  isLiveContent?: boolean;
  isLive?: boolean;
  likes?: number | null;
  age_restricted?: boolean;
  video_url?: string;
  [key: string]: unknown;
}

interface VideoInfo {
  full: boolean;
  page: string[];
  player_response: Record<string, unknown>;
  response?: Record<string, unknown>;
  html5player?: string | null;
  formats: CompatFormat[];
  related_videos?: unknown[];
  videoDetails: VideoDetails;
  video_url?: string;
  videoUrl?: string;
  bestFormat?: CompatFormat;
  selectedFormat?: CompatFormat;
  [key: string]: unknown;
}

interface getInfoOptions {
  lang?: string;
  agent?: YoutubeDLParams["agent"];
  playerClients?: Array<"WEB_EMBEDDED" | "TV" | "IOS" | "ANDROID" | "WEB" | string>;
  requestOptions?: Record<string, unknown>;
  poTokens?: YoutubeDLParams["poTokens"];
  headers?: Record<string, string>;
}

interface chooseFormatOptions {
  quality?:
    | "lowest"
    | "highest"
    | "highestaudio"
    | "lowestaudio"
    | "highestvideo"
    | "lowestvideo"
    | string
    | number
    | string[]
    | number[];
  filter?: Filter;
  format?: CompatFormat;
}

interface downloadOptions extends getInfoOptions, chooseFormatOptions {
  range?: { start?: number; end?: number };
  begin?: string | number | Date;
  liveBuffer?: number;
  highWaterMark?: number;
  IPv6Block?: string;
  dlChunkSize?: number;
}

function mapClient(name: string): string {
  const map: Record<string, string> = {
    WEB: "web",
    WEB_EMBEDDED: "web_embedded",
    TV: "tv",
    IOS: "ios",
    ANDROID: "android",
  };
  return map[name] || name.toLowerCase();
}

function toParams(options: getInfoOptions = {}): YoutubeDLParams {
  return {
    agent: options.agent,
    lang: options.lang,
    headers: options.headers,
    poTokens: options.poTokens,
    playerClients: options.playerClients?.map(mapClient),
  };
}

function enrichFormat(f: Format): CompatFormat {
  const hasAudio = !!(f.has_audio ?? f.hasAudio);
  const hasVideo = !!(f.has_video ?? f.hasVideo);
  const mime = f.mimeType || "";
  const codecsMatch = /codecs="([^"]+)"/.exec(mime);
  const codecs = codecsMatch?.[1] || [f.vcodec, f.acodec].filter(c => c && c !== "none").join(", ");
  return {
    ...f,
    hasAudio,
    hasVideo,
    has_audio: hasAudio,
    has_video: hasVideo,
    isLive: !!f.is_live,
    container: f.ext,
    codecs,
    videoCodec: f.vcodec && f.vcodec !== "none" ? String(f.vcodec) : undefined,
    audioCodec: f.acodec && f.acodec !== "none" ? String(f.acodec) : undefined,
    itag: f.itag ?? (Number(f.format_id) || 0),
    url: f.url || f.manifest_url || "",
    lastModified: f.lastModified || "",
    contentLength: f.contentLength || (f.filesize != null ? String(f.filesize) : ""),
    qualityLabel: f.qualityLabel || undefined,
  } as CompatFormat;
}

function infoDictToVideoInfo(info: InfoDict, full: boolean): VideoInfo {
  const pr =
    (info._player_responses as Record<string, unknown>[] | undefined)?.[0] ||
    ({} as Record<string, unknown>);
  const formats = (info.formats || []).map(enrichFormat);
  const details: VideoDetails = {
    videoId: info.id,
    title: info.title || info.id,
    lengthSeconds: String(info.duration || 0),
    channelId: info.channel_id || undefined,
    shortDescription: info.description || undefined,
    viewCount: info.view_count != null ? String(info.view_count) : undefined,
    author: info.channel || info.uploader || undefined,
    isLiveContent: !!info.was_live || !!info.is_live,
    isLive: !!info.is_live,
    likes: info.like_count ?? null,
    age_restricted: (info.age_limit || 0) >= 18,
    video_url: info.webpage_url,
    thumbnail: {
      thumbnails: (info.thumbnails || []).map(t => ({
        url: t.url,
        width: t.width,
        height: t.height,
      })),
    },
  };

  const best =
    formats.find(f => f.hasVideo && f.hasAudio) ||
    formats.find(f => f.hasVideo) ||
    formats.find(f => f.hasAudio) ||
    formats[0];

  return {
    full,
    page: ["watch"],
    player_response: pr,
    html5player: (info._player_url as string) || null,
    formats,
    related_videos: [],
    videoDetails: details,
    video_url: info.webpage_url,
    videoUrl: best?.url,
    bestFormat: best,
    selectedFormat: best,
  };
}

const infoCache = new Map<string, { value: Promise<VideoInfo>; expires: number }>();
const watchCache = new Map<string, { value: Promise<string>; expires: number }>();
const CACHE_TTL = 60_000;

function cacheGetOrSet<T>(
  map: Map<string, { value: Promise<T>; expires: number }>,
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const hit = map.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = fn();
  map.set(key, { value, expires: Date.now() + CACHE_TTL });
  value.catch(() => map.delete(key));
  return value;
}

async function getInfoInternal(link: string, options: getInfoOptions = {}, full: boolean): Promise<VideoInfo> {
  const id = getVideoID(link);
  const key = `${id}:${full}:${JSON.stringify(options.playerClients || [])}`;
  return cacheGetOrSet(infoCache, key, async () => {
    const ydl = new YoutubeDL(toParams(options));
    const info = await ydl.extractInfo(id);
    return infoDictToVideoInfo(info, full);
  });
}

async function getBasicInfo(link: string, options?: getInfoOptions): Promise<VideoInfo> {
  const info = await getInfoInternal(link, options, false);
  // basic info historically skipped deciphered adaptive URLs; we still return formats from jsless clients
  return info;
}

async function getInfo(link: string, options?: getInfoOptions): Promise<VideoInfo> {
  return getInfoInternal(link, options, true);
}

function chooseFormat(formats: CompatFormat | CompatFormat[], options?: chooseFormatOptions): CompatFormat {
  const list = Array.isArray(formats) ? formats : [formats];
  return coreChooseFormat(list, options || {}) as CompatFormat;
}

function filterFormats(formats: CompatFormat[], filter?: Filter): CompatFormat[] {
  if (typeof filter === "function") {
    return formats.filter(filter);
  }
  return coreFilterFormats(formats, filter) as CompatFormat[];
}

function downloadFromInfoCallback(stream: PassThrough, info: VideoInfo, options: downloadOptions = {}): void {
  if (!info.formats?.length) {
    stream.emit("error", new Error("This video is unavailable"));
    return;
  }
  let format: CompatFormat;
  try {
    format = chooseFormat(info.formats, options);
  } catch (e) {
    stream.emit("error", e);
    return;
  }
  stream.emit("info", info, format);
  if ((stream as PassThrough & { destroyed?: boolean }).destroyed) return;

  const media = downloadFormat(format, toParams(options), {
    range: options.range,
    begin: options.begin,
    liveBuffer: options.liveBuffer,
    highWaterMark: options.highWaterMark,
    dlChunkSize: options.dlChunkSize,
  });
  media.on("error", err => stream.emit("error", err));
  media.on("progress", (...args: unknown[]) => stream.emit("progress", ...args));
  media.pipe(stream);
}

function downloadFromInfo(info: VideoInfo, options?: downloadOptions): Readable {
  const stream = new PassThrough({ highWaterMark: options?.highWaterMark || 1024 * 512 });
  if (!info.full) {
    throw new Error("Cannot use `ytdl.downloadFromInfo()` when called with info from `ytdl.getBasicInfo()`");
  }
  setImmediate(() => downloadFromInfoCallback(stream, info, options));
  return stream;
}

function ytdl(link: string, options?: downloadOptions): Readable {
  const stream = new PassThrough({ highWaterMark: options?.highWaterMark || 1024 * 512 });
  getInfo(link, options).then(
    info => downloadFromInfoCallback(stream, info, options),
    err => stream.emit("error", err),
  );
  return stream;
}

ytdl.getBasicInfo = getBasicInfo;
ytdl.getInfo = getInfo;
ytdl.downloadFromInfo = downloadFromInfo;
ytdl.chooseFormat = chooseFormat;
ytdl.filterFormats = filterFormats;
ytdl.validateID = validateID;
ytdl.validateURL = validateURL;
ytdl.getURLVideoID = getURLVideoID;
ytdl.getVideoID = getVideoID;
ytdl.createAgent = createAgent;
ytdl.createProxyAgent = createProxyAgent;
ytdl.cache = {
  info: infoCache,
  watch: watchCache,
};
ytdl.version = pkg.version;

export = ytdl;
