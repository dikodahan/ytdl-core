import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  YT_BASE,
  callPlayerApi,
  extractPlayerJsUrl,
  extractSignatureTimestamp,
  extractVisitorData,
  extractYtcfg,
  getVideoID,
  parseYtInitialPlayerResponse,
  playabilityError,
  validateURL,
} from "./base";
import { INNERTUBE_CLIENTS, VLC_CLIENTS } from "./clients";
import { NodeEjsChallengeSolver, type ChallengeRequest } from "./jsc/solver";
import { ManualPoTokenProvider, PoTokenDirector, attachGvsPoToken } from "./pot";

interface StreamingFormat {
  itag?: number;
  url?: string;
  signatureCipher?: string;
  cipher?: string;
  mimeType?: string;
  bitrate?: number;
  width?: number;
  height?: number;
  fps?: number;
  quality?: string;
  qualityLabel?: string;
  contentLength?: string;
  lastModified?: string;
  approxDurationMs?: string;
  averageBitrate?: number;
  audioQuality?: string;
  audioSampleRate?: string;
  audioChannels?: number;
  loudnessDb?: number;
  initRange?: { start: string; end: string };
  indexRange?: { start: string; end: string };
  projectionType?: string;
  [key: string]: unknown;
}

export class YoutubeIE extends InfoExtractor {
  static IE_NAME = "youtube";
  static IE_DESC = "YouTube videos (watch, Shorts, live, music)";
  static readonly _VALID_URL =
    /^https?:\/\/(?:www\.|m\.|music\.|gaming\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)|^[a-zA-Z0-9_-]{11}$/;

  static suitable(url: string): boolean {
    return validateURL(url) || /^[a-zA-Z0-9_-]{11}$/.test(url.trim());
  }

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — tuned for local VLC (progressive muxed + HLS)`,
      validUrl: String(this._VALID_URL),
      options: [
        {
          key: "vlcOnly",
          label: "VLC-ready only",
          type: "boolean",
          description: "Only return progressive muxed / HLS URLs VLC can open without ffmpeg merge",
          default: true,
        },
        {
          key: "poTokens",
          label: "PO tokens (optional)",
          type: "textarea",
          description: "One per line: client.context+TOKEN — only if streams 403 without them",
          default: "",
        },
        {
          key: "lang",
          label: "Language",
          type: "string",
          default: "en",
        },
      ],
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const videoId = getVideoID(url);
    const potDirector = new PoTokenDirector();
    if (this.params.poTokens) {
      potDirector.register(new ManualPoTokenProvider(this.params.poTokens));
    }

    const watchUrl = `${YT_BASE}/watch?v=${videoId}&hl=${this.params.lang || "en"}&bpctr=${Math.ceil(Date.now() / 1000)}&has_verified=1`;
    const webpage = await this.request.text(watchUrl);
    const initialPr = parseYtInitialPlayerResponse(webpage);
    const ytcfg = extractYtcfg(webpage);
    let playerUrl = extractPlayerJsUrl(webpage);

    if (!playerUrl) {
      try {
        const embed = await this.request.text(`${YT_BASE}/embed/${videoId}?hl=${this.params.lang || "en"}`);
        playerUrl = extractPlayerJsUrl(embed);
      } catch {
        /* ignore */
      }
    }

    const visitorData = extractVisitorData(initialPr, ytcfg);
    let signatureTimestamp: string | null = null;
    if (playerUrl) {
      try {
        const playerJs = await this.request.text(playerUrl);
        signatureTimestamp = extractSignatureTimestamp(playerJs);
      } catch {
        /* optional for jsless clients */
      }
    }

    const clients = this.resolveClients();
    const playerResponses: Array<{ client: string; pr: Record<string, unknown> }> = [];

    for (const client of clients) {
      try {
        const playerPo =
          (await potDirector.getPoToken({
            client,
            context: "player",
            videoId,
            visitorData,
          })) || undefined;

        // Always send sts when known — several clients need it for real stream URLs
        const pr = await callPlayerApi(this.request, videoId, client, {
          visitorData,
          signatureTimestamp,
          poToken: playerPo,
        });

        const wrongId = (pr.videoDetails as { videoId?: string } | undefined)?.videoId;
        if (wrongId && wrongId !== videoId) {
          continue;
        }

        const err = playabilityError(pr);
        if (err && !(pr.streamingData as object | undefined)) {
          continue;
        }

        playerResponses.push({ client, pr });
      } catch {
        /* try next client */
      }
    }

    if (!playerResponses.length && initialPr) {
      playerResponses.push({ client: "webpage", pr: initialPr });
    }

    if (!playerResponses.length) {
      throw new Error("Failed to obtain a YouTube player response");
    }

    const primary = playerResponses[0].pr;
    const playErr = playabilityError(primary);
    if (playErr && !playerResponses.some(p => p.pr.streamingData)) {
      throw playErr;
    }

    let formats: Format[] = [];
    const challengeRequests: ChallengeRequest[] = [];
    const formatMeta: Array<{ format: Format; client: string; needsSig: boolean; needsN: boolean; rawN?: string; rawS?: string; sp?: string }> =
      [];

    for (const { client, pr } of playerResponses) {
      const sd = pr.streamingData as
        | {
            formats?: StreamingFormat[];
            adaptiveFormats?: StreamingFormat[];
            hlsManifestUrl?: string;
            dashManifestUrl?: string;
          }
        | undefined;
      if (!sd) continue;

      const rawFormats = [...(sd.formats || []), ...(sd.adaptiveFormats || [])];
      // SABR-only: no url / cipher on formats
      const usable = rawFormats.filter(f => f.url || f.signatureCipher || f.cipher);
      if (!usable.length && !sd.hlsManifestUrl && !sd.dashManifestUrl) {
        continue;
      }

      const gvsPo = await potDirector.getPoToken({
        client,
        context: "gvs",
        videoId,
        visitorData,
      });

      for (const raw of usable) {
        const parsed = this.parseStreamingFormat(raw, client, gvsPo);
        formats.push(parsed.format);
        formatMeta.push({ ...parsed.meta, format: parsed.format, client });
      }

      if (sd.hlsManifestUrl) {
        formats.push({
          format_id: `hls-${client}`,
          url: attachGvsPoToken(sd.hlsManifestUrl, gvsPo),
          protocol: "m3u8_native",
          ext: "mp4",
          isHLS: true,
          has_video: true,
          has_audio: true,
          client,
          format_note: `HLS (${client})`,
        });
      }
      if (sd.dashManifestUrl) {
        formats.push({
          format_id: `dash-${client}`,
          url: attachGvsPoToken(sd.dashManifestUrl, gvsPo),
          manifest_url: attachGvsPoToken(sd.dashManifestUrl, gvsPo),
          protocol: "http_dash_segments",
          ext: "mp4",
          isDashMPD: true,
          has_video: true,
          has_audio: true,
          client,
          format_note: `DASH (${client})`,
        });
      }
    }

    // Bulk-solve n/sig challenges (EJS returns challenge→result maps)
    if (playerUrl) {
      const nChallenges = [
        ...new Set(formatMeta.filter(m => m.needsN && m.rawN).map(m => m.rawN as string)),
      ];
      const sigChallenges = [
        ...new Set(formatMeta.filter(m => m.needsSig && m.rawS).map(m => m.rawS as string)),
      ];

      if (nChallenges.length || sigChallenges.length) {
        try {
          const solver = new NodeEjsChallengeSolver(this.request);
          const reqs: ChallengeRequest[] = [];
          if (nChallenges.length) {
            reqs.push({ type: "n", challenges: nChallenges, playerUrl, videoId });
          }
          if (sigChallenges.length) {
            reqs.push({ type: "sig", challenges: sigChallenges, playerUrl, videoId });
          }
          const solved = await solver.solve(reqs);
          const nMap = solved.find(r => r.type === "n")?.results || {};
          const sigMap = solved.find(r => r.type === "sig")?.results || {};

          for (const meta of formatMeta) {
            if (!meta.format.url) continue;
            if (meta.rawN && nMap[meta.rawN]) {
              meta.format.url = setQueryParam(meta.format.url, "n", nMap[meta.rawN]);
            }
            if (meta.rawS && sigMap[meta.rawS]) {
              meta.format.url = setQueryParam(meta.format.url, meta.sp || "signature", sigMap[meta.rawS]);
            }
          }
        } catch (err) {
          if (!this.params.quiet) {
            console.warn(`[youtube] JS challenge solving failed: ${(err as Error).message}`);
          }
        }
      }
    }

    formats = formats.filter(f => f.url || f.manifest_url);
    formats = dedupeFormats(formats);

    const vlcOnly = this.params.vlcOnly !== false;
    if (vlcOnly) {
      formats = formats.filter(isVlcReady);
    }

    // Prefer muxed progressive, then HLS, for local players
    formats.sort((a, b) => vlcScore(b) - vlcScore(a));

    if (!formats.length) {
      throw new Error(
        "No VLC-playable formats found. Try disabling “VLC-ready only”, or pass PO tokens if streams are gated.",
      );
    }

    const details = (primary.videoDetails || {}) as Record<string, unknown>;
    const micro =
      ((primary.microformat as { playerMicroformatRenderer?: Record<string, unknown> } | undefined)
        ?.playerMicroformatRenderer) || {};

    const title = String(details.title || micro.title || videoId);
    const lengthSeconds = Number(details.lengthSeconds || micro.lengthSeconds || 0) || null;
    const thumbnails = extractThumbnails(details);

    const info: InfoDict = {
      id: videoId,
      title,
      description: (details.shortDescription as string) || null,
      duration: lengthSeconds,
      channel: (details.author as string) || null,
      channel_id: (details.channelId as string) || null,
      channel_url: details.channelId ? `${YT_BASE}/channel/${details.channelId}` : null,
      uploader: (details.author as string) || null,
      view_count: details.viewCount != null ? Number(details.viewCount) : null,
      age_limit: details.isAdult ? 18 : 0,
      thumbnails,
      thumbnail: thumbnails?.[0]?.url,
      formats,
      webpage_url: `${YT_BASE}/watch?v=${videoId}`,
      original_url: url,
      extractor: "youtube",
      extractor_key: "Youtube",
      is_live: !!(details.isLive || details.isLiveContent),
      live_status: details.isLive ? "is_live" : details.isLiveContent ? "was_live" : "not_live",
      _player_responses: playerResponses.map(p => p.pr),
      _player_url: playerUrl,
      _visitor_data: visitorData,
      _yt_player_responses: playerResponses,
    };

    return info;
  }

  private resolveClients(): string[] {
    if (this.params.playerClients?.length) {
      return this.params.playerClients.map(normalizeClientName);
    }
    // mweb/android return progressive muxed URLs suitable for VLC
    return [...VLC_CLIENTS];
  }

  private parseStreamingFormat(
    raw: StreamingFormat,
    client: string,
    gvsPo: string | null,
  ): {
    format: Format;
    meta: { needsSig: boolean; needsN: boolean; rawN?: string; rawS?: string; sp?: string };
  } {
    let url = raw.url || "";
    let needsSig = false;
    let needsN = false;
    let rawN: string | undefined;
    let rawS: string | undefined;
    let sp: string | undefined;

    const cipher = raw.signatureCipher || raw.cipher;
    if (cipher) {
      const params = new URLSearchParams(cipher);
      url = params.get("url") || "";
      rawS = params.get("s") || undefined;
      sp = params.get("sp") || "signature";
      needsSig = !!rawS;
    }

    if (url) {
      try {
        const u = new URL(url);
        const n = u.searchParams.get("n");
        if (n) {
          needsN = true;
          rawN = n;
        }
      } catch {
        /* ignore */
      }
    }

    url = attachGvsPoToken(url, gvsPo);

    const mimeType = raw.mimeType || "";
    const codecsMatch = /codecs="([^"]+)"/.exec(mimeType);
    const codecs = codecsMatch?.[1] || "";
    const isAudio = mimeType.startsWith("audio/");
    const isVideo = mimeType.startsWith("video/");
    const has_video = isVideo || (!!raw.width && !!raw.height);
    const has_audio = isAudio || /mp4a|opus|vorbis|flac|ac-3|ec-3/i.test(codecs) || (!has_video && !!raw.audioQuality);

    const format: Format = {
      format_id: String(raw.itag ?? `${client}-unknown`),
      itag: raw.itag,
      url,
      mimeType,
      ext: mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "mp4" : "unknown",
      protocol: "https",
      width: raw.width ?? null,
      height: raw.height ?? null,
      fps: raw.fps ?? null,
      tbr: raw.bitrate ? raw.bitrate / 1000 : null,
      bitrate: raw.bitrate,
      abr: raw.averageBitrate && isAudio ? raw.averageBitrate / 1000 : null,
      audioBitrate: raw.averageBitrate && isAudio ? Math.round(raw.averageBitrate / 1000) : undefined,
      vcodec: has_video ? codecs.split(",")[0]?.trim() || "unknown" : "none",
      acodec: has_audio
        ? codecs
            .split(",")
            .map(c => c.trim())
            .find(c => /mp4a|opus|vorbis|flac|ac-3|ec-3/i.test(c)) || (isAudio ? codecs : "unknown")
        : "none",
      qualityLabel: raw.qualityLabel,
      quality: typeof raw.quality === "string" ? undefined : (raw.quality as number | undefined),
      format_note: raw.qualityLabel || (raw.quality as string) || client,
      resolution: raw.width && raw.height ? `${raw.width}x${raw.height}` : null,
      filesize: raw.contentLength ? Number(raw.contentLength) : null,
      contentLength: raw.contentLength,
      lastModified: raw.lastModified,
      approxDurationMs: raw.approxDurationMs,
      averageBitrate: raw.averageBitrate,
      audioQuality: raw.audioQuality,
      audioSampleRate: raw.audioSampleRate,
      audioChannels: raw.audioChannels,
      loudnessDb: raw.loudnessDb,
      initRange: raw.initRange,
      indexRange: raw.indexRange,
      projectionType: raw.projectionType,
      has_audio,
      has_video,
      hasAudio: has_audio,
      hasVideo: has_video,
      client,
      signatureCipher: cipher,
    };

    return { format, meta: { needsSig, needsN, rawN, rawS, sp } };
  }
}

function normalizeClientName(name: string): string {
  const lower = name.toLowerCase();
  if (INNERTUBE_CLIENTS[lower]) return lower;
  const map: Record<string, string> = {
    web: "web",
    web_embedded: "web_embedded",
    tv: "tv",
    ios: "ios",
    android: "android",
    mweb: "mweb",
  };
  return map[lower] || lower;
}

/** Progressive muxed (A+V) or HLS — what VLC can open as a single URL */
function isVlcReady(f: Format): boolean {
  if (f.isHLS || f.protocol === "m3u8_native") return !!(f.url || f.manifest_url);
  if (!f.url) return false;
  const hasVideo = !!(f.has_video ?? f.hasVideo);
  const hasAudio = !!(f.has_audio ?? f.hasAudio);
  return hasVideo && hasAudio;
}

function vlcScore(f: Format): number {
  const height = f.height || parseInt(String(f.qualityLabel || "0"), 10) || 0;
  const muxed = isVlcReady(f) && !f.isHLS ? 1_000_000 : 0;
  const hls = f.isHLS ? 500_000 : 0;
  return muxed + hls + height * 100 + (f.tbr || 0);
}

function setQueryParam(url: string, key: string, value: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set(key, value);
    return u.toString();
  } catch {
    return url;
  }
}

function dedupeFormats(formats: Format[]): Format[] {
  const seen = new Set<string>();
  const out: Format[] = [];
  for (const f of formats) {
    const key = `${f.format_id}|${f.url || f.manifest_url}|${f.client || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

function extractThumbnails(details: Record<string, unknown>): InfoDict["thumbnails"] {
  const thumbs =
    (details.thumbnail as { thumbnails?: Array<{ url: string; width?: number; height?: number }> } | undefined)
      ?.thumbnails || [];
  return thumbs.map((t, i) => ({
    url: t.url,
    width: t.width,
    height: t.height,
    preference: i,
    id: String(i),
  }));
}
