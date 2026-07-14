import type { Dispatcher } from "undici";
import type { CookieJar } from "tough-cookie";
import type { ImpersonateProfile } from "../networking/cloudflare";

export interface Agent {
  dispatcher: Dispatcher;
  jar: CookieJar;
  localAddress?: string;
}

export interface PoTokenMap {
  /** client.context → token, e.g. "android_vr.gvs" */
  [clientContext: string]: string;
}

export interface YoutubeDLParams {
  quiet?: boolean;
  verbose?: boolean;
  agent?: Agent;
  headers?: Record<string, string>;
  proxy?: string;
  /** Innertube player clients to try (yt-dlp names) */
  playerClients?: string[];
  /** Manual PO tokens: "client.context+token" or map */
  poTokens?: string[] | PoTokenMap;
  /** Format selector: "best", "bestvideo+bestaudio", "worst", etc. */
  format?: string;
  lang?: string;
  /** Prefer progressive muxed / HLS URLs suitable for local VLC (default true) */
  vlcOnly?: boolean;
  /** Skip decipher when client does not need JS (still attempted for others) */
  skipDownload?: boolean;
  /**
   * Browser profile for request headers (chrome|firefox|safari|edge).
   * Use with `cloudflareBypass` / `forceImpersonate` for CycleTLS JA3 spoofing.
   */
  impersonate?: boolean | ImpersonateProfile;
  /** Retry Cloudflare challenge responses via CycleTLS */
  cloudflareBypass?: boolean;
  /** Force CycleTLS for every request (may break YouTube Innertube) */
  forceImpersonate?: boolean;
  /**
   * Force a specific extractor by `IE_NAME` / module id (e.g. `vimeo`, `dailymotion`).
   * Alias: `service`.
   */
  site?: string;
  /** Alias for `site` */
  service?: string;
  /** Site-specific options forwarded from the API / UI */
  extractorArgs?: Record<string, unknown>;
}

export interface Format {
  format_id: string;
  url?: string;
  manifest_url?: string;
  ext?: string;
  protocol?: string;
  acodec?: string | null;
  vcodec?: string | null;
  width?: number | null;
  height?: number | null;
  fps?: number | null;
  tbr?: number | null;
  abr?: number | null;
  vbr?: number | null;
  filesize?: number | null;
  quality?: number | null;
  format_note?: string | null;
  resolution?: string | null;
  audio_ext?: string;
  video_ext?: string;
  has_audio?: boolean;
  has_video?: boolean;
  is_live?: boolean;
  source_preference?: number;
  language?: string | null;
  /** Raw YouTube fields preserved for compat */
  itag?: number;
  mimeType?: string;
  bitrate?: number;
  audioBitrate?: number;
  qualityLabel?: string;
  contentLength?: string;
  lastModified?: string;
  averageBitrate?: number;
  approxDurationMs?: string;
  audioQuality?: string;
  audioSampleRate?: string;
  audioChannels?: number;
  loudnessDb?: number;
  initRange?: { start: string; end: string };
  indexRange?: { start: string; end: string };
  projectionType?: string;
  fingerprint?: unknown;
  isHLS?: boolean;
  isDashMPD?: boolean;
  signatureCipher?: string;
  cipher?: string;
  n?: string;
  s?: string;
  sp?: string;
  client?: string;
  _pot_required?: boolean;
  [key: string]: unknown;
}

export interface Thumbnail {
  url: string;
  width?: number;
  height?: number;
  preference?: number;
  id?: string;
}

export interface InfoDict {
  id: string;
  title?: string;
  description?: string | null;
  duration?: number | null;
  channel?: string | null;
  channel_id?: string | null;
  channel_url?: string | null;
  uploader?: string | null;
  uploader_id?: string | null;
  uploader_url?: string | null;
  upload_date?: string | null;
  timestamp?: number | null;
  view_count?: number | null;
  like_count?: number | null;
  age_limit?: number;
  categories?: string[];
  tags?: string[];
  thumbnails?: Thumbnail[];
  thumbnail?: string;
  formats?: Format[];
  requested_formats?: Format[];
  url?: string;
  ext?: string;
  webpage_url?: string;
  original_url?: string;
  extractor?: string;
  extractor_key?: string;
  is_live?: boolean | null;
  was_live?: boolean | null;
  live_status?: string | null;
  subtitles?: Record<string, unknown>;
  automatic_captions?: Record<string, unknown>;
  chapters?: Array<{ start_time: number; end_time?: number; title: string }>;
  /** Internal / compat helpers */
  _player_responses?: Record<string, unknown>[];
  _player_url?: string | null;
  _visitor_data?: string | null;
  [key: string]: unknown;
}

export type ExtractResult = InfoDict;
