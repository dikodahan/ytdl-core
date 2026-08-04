import type { IncomingMessage } from "http";
import type { YoutubeDLParams } from "../core/types";
import type { ImpersonateProfile } from "../networking/cloudflare";
import { YoutubeDL } from "../core/youtube-dl";
import { findExtractorByName, listExtractorInfo, resolveExtractor } from "../core/registry";
import { listPlannedModules, migrationStatusBySite } from "../migration/tracker";
import { withUrlUsage } from "../extractor/url-usage";

export function isLoopback(req: IncomingMessage): boolean {
  const raw = req.socket.remoteAddress || "";
  return (
    raw === "127.0.0.1" ||
    raw === "::1" ||
    raw === "::ffff:127.0.0.1" ||
    raw.endsWith("127.0.0.1")
  );
}

export function extractBearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  const alt = req.headers["x-api-token"];
  if (typeof alt === "string" && alt.trim()) return alt.trim();
  return null;
}

const KNOWN_KEYS = new Set([
  "url",
  "site",
  "service",
  "playerClients",
  "poTokens",
  "format",
  "lang",
  "proxy",
  "impersonate",
  "cloudflareBypass",
  "forceImpersonate",
  "vlcOnly",
  "quiet",
  "verbose",
  "skipDownload",
  "extractorArgs",
  "headers",
]);

export type ExtractRequest = YoutubeDLParams & { url?: string; site?: string; service?: string };

export function parseExtractBody(raw: string): ExtractRequest {
  const data = JSON.parse(raw || "{}") as Record<string, unknown>;
  const poTokensRaw = data.poTokens;
  let poTokens: string[] | undefined;
  if (typeof poTokensRaw === "string" && poTokensRaw.trim()) {
    poTokens = poTokensRaw
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
  } else if (Array.isArray(poTokensRaw)) {
    poTokens = poTokensRaw.map(String);
  }

  let playerClients = data.playerClients as string[] | undefined;
  if (typeof data.playerClients === "string") {
    playerClients = data.playerClients
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
  }

  const impersonateRaw = data.impersonate;
  const impersonate =
    impersonateRaw === false || impersonateRaw === "" || impersonateRaw == null
      ? undefined
      : (impersonateRaw as boolean | ImpersonateProfile);

  const site =
    (typeof data.site === "string" && data.site) ||
    (typeof data.service === "string" && data.service) ||
    undefined;

  const extractorArgs: Record<string, unknown> = {
    ...((data.extractorArgs && typeof data.extractorArgs === "object"
      ? data.extractorArgs
      : {}) as Record<string, unknown>),
  };
  for (const [k, v] of Object.entries(data)) {
    if (KNOWN_KEYS.has(k)) continue;
    extractorArgs[k] = v;
  }

  return {
    url: typeof data.url === "string" ? data.url : undefined,
    site,
    service: site,
    playerClients,
    poTokens,
    format: typeof data.format === "string" ? data.format : undefined,
    lang: typeof data.lang === "string" ? data.lang : undefined,
    proxy: typeof data.proxy === "string" && data.proxy ? data.proxy : undefined,
    impersonate,
    cloudflareBypass: data.cloudflareBypass === true,
    forceImpersonate: data.forceImpersonate === true,
    vlcOnly: data.vlcOnly !== false,
    quiet: true,
    extractorArgs: Object.keys(extractorArgs).length ? extractorArgs : undefined,
  };
}

export function metaPayload() {
  const statusMap = migrationStatusBySite();
  const registered = listExtractorInfo().map(info => {
    const mig = statusMap.get(info.name);
    return {
      ...info,
      status: mig?.status || ("ready" as const),
      batch: mig?.batch ?? null,
    };
  });
  const registeredNames = new Set(registered.map(s => s.name));
  const planned = listPlannedModules()
    .filter(m => !registeredNames.has(m.id))
    .map(m =>
      withUrlUsage({
        name: m.id,
        description: `Planned (${m.batchTitle})`,
        validUrl: "",
        options: [],
        status: m.status === "ready" ? ("planned" as const) : m.status,
        batch: m.batch,
      }),
    );

  return {
    sites: [...registered, ...planned],
    capabilities: YoutubeDL.capabilities(),
    globalOptions: [
      {
        key: "service",
        label: "Service",
        type: "select",
        description: "Force extractor (alias: site). Omit to auto-detect from URL.",
        default: "",
        choices: [
          { value: "", label: "Auto" },
          ...registered.map(s => ({ value: s.name, label: s.name })),
        ],
      },
      {
        key: "impersonate",
        label: "Browser profile",
        type: "select",
        description: "Header profile; CycleTLS uses the same profile for CF retries",
        default: "",
        choices: [
          { value: "", label: "Default" },
          { value: "chrome", label: "Chrome" },
          { value: "firefox", label: "Firefox" },
          { value: "safari", label: "Safari" },
          { value: "edge", label: "Edge" },
        ],
      },
      {
        key: "cloudflareBypass",
        label: "Cloudflare bypass",
        type: "boolean",
        description: "If Undici hits a CF challenge, retry that request via CycleTLS",
        default: true,
      },
      {
        key: "forceImpersonate",
        label: "Force CycleTLS",
        type: "boolean",
        description: "Send every request through CycleTLS (can break YouTube Innertube)",
        default: false,
      },
      {
        key: "proxy",
        label: "Proxy URL",
        type: "string",
        description: "http://host:port or socks5://…",
        default: "",
      },
    ],
    api: {
      version: "v1",
      auth: "Authorization: Bearer <token>",
      endpoints: [
        { method: "GET", path: "/api/v1/health", auth: false },
        { method: "GET", path: "/api/v1/meta", auth: true },
        { method: "POST", path: "/api/v1/extract", auth: true },
        { method: "POST", path: "/api/v1/list", auth: true },
        { method: "POST", path: "/api/v1/discover/kaltura-ott", auth: true },
        { method: "GET", path: "/api/v1/tokens", auth: "loopback or bearer" },
        { method: "POST", path: "/api/v1/tokens", auth: "loopback or bearer" },
        { method: "POST", path: "/api/v1/tokens/:id/revoke", auth: "loopback or bearer" },
        { method: "DELETE", path: "/api/v1/tokens/:id", auth: "loopback or bearer" },
      ],
    },
  };
}

export async function runExtract(parsed: ExtractRequest) {
  const target = parsed.url?.trim();
  if (!target) {
    return { status: 400 as const, body: { error: "url is required" } };
  }

  const site = parsed.site || parsed.service;
  if (site) {
    if (!findExtractorByName(site)) {
      return { status: 400 as const, body: { error: `Unknown site: ${site}` } };
    }
    try {
      resolveExtractor(target, site);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: 400 as const, body: { error: message } };
    }
  }

  const started = Date.now();
  const ydl = new YoutubeDL({ ...parsed, site, service: site });
  try {
    const info = await ydl.extractInfo(target);
    return {
      status: 200 as const,
      body: {
        ok: true,
        elapsedMs: Date.now() - started,
        extractor: info.extractor || info.extractor_key,
        id: info.id,
        title: info.title,
        duration: info.duration,
        thumbnail: info.thumbnail,
        webpage_url: info.webpage_url,
        formatCount: info.formats?.length || 0,
        formats: (info.formats || []).map(f => ({
          format_id: f.format_id,
          itag: f.itag,
          ext: f.ext,
          protocol: f.protocol,
          resolution: f.resolution || f.qualityLabel || null,
          qualityLabel: f.qualityLabel,
          fps: f.fps,
          vcodec: f.vcodec,
          acodec: f.acodec,
          tbr: f.tbr,
          filesize: f.filesize,
          has_video: f.has_video,
          has_audio: f.has_audio,
          isHLS: f.isHLS,
          isDashMPD: f.isDashMPD,
          client: f.client,
          vlc_ready: !!(
            f.isHLS ||
            ((f.has_video ?? f.hasVideo) && (f.has_audio ?? f.hasAudio) && f.url)
          ),
          url: f.url || f.manifest_url || null,
          http_headers: f.http_headers || null,
        })),
        recommended: (() => {
          const f =
            info.formats?.find(
              x => (x.has_video ?? x.hasVideo) && (x.has_audio ?? x.hasAudio) && x.url && !x.isHLS,
            ) || info.formats?.find(x => x.isHLS && (x.url || x.manifest_url));
          if (!f) return null;
          return {
            format_id: f.format_id,
            itag: f.itag,
            qualityLabel: f.qualityLabel,
            resolution: f.resolution,
            client: f.client,
            url: f.url || f.manifest_url || null,
            http_headers: f.http_headers || null,
          };
        })(),
      },
    };
  } finally {
    await ydl.close();
  }
}
