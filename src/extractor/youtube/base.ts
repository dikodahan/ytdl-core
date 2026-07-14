import type { RequestClient } from "../../networking/request";
import { getClientConfig, type InnertubeClient } from "./clients";

export const YT_BASE = "https://www.youtube.com";

export const idRegex = /^[a-zA-Z0-9_-]{11}$/;

const validQueryDomains = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "gaming.youtube.com",
]);
const validPathDomains = /^https?:\/\/(youtu\.be\/|(www\.)?youtube\.com\/(embed|v|shorts|live)\/)/;

export function validateID(id: string): boolean {
  return idRegex.test(id.trim());
}

export function getURLVideoID(link: string): string {
  const parsed = new URL(link.trim());
  let id = parsed.searchParams.get("v");
  if (validPathDomains.test(link.trim()) && !id) {
    const paths = parsed.pathname.split("/");
    id = parsed.host === "youtu.be" ? paths[1] : paths[2];
  } else if (parsed.hostname && !validQueryDomains.has(parsed.hostname)) {
    throw new Error("Not a YouTube domain");
  }
  if (!id) throw new Error(`No video id found: "${link}"`);
  id = id.substring(0, 11);
  if (!validateID(id)) {
    throw new TypeError(`Video id (${id}) does not match expected format`);
  }
  return id;
}

export function getVideoID(str: string): string {
  if (validateID(str)) return str.trim();
  if (/^https?:\/\//.test(str.trim())) return getURLVideoID(str);
  throw new Error(`No video id found: ${str}`);
}

export function validateURL(string: string): boolean {
  try {
    getURLVideoID(string);
    return true;
  } catch {
    return false;
  }
}

export function between(haystack: string, left: string | RegExp, right: string): string {
  let pos: number;
  if (left instanceof RegExp) {
    const m = left.exec(haystack);
    if (!m) return "";
    pos = m.index + m[0].length;
  } else {
    pos = haystack.indexOf(left);
    if (pos === -1) return "";
    pos += left.length;
  }
  const end = haystack.indexOf(right, pos);
  if (end === -1) return "";
  return haystack.slice(pos, end);
}

export function parseYtInitialPlayerResponse(body: string): Record<string, unknown> | null {
  const patterns = [
    /ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var\s+(?:meta|head)|<\/script|\n)/s,
    /ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s,
  ];
  for (const re of patterns) {
    const m = re.exec(body);
    if (m?.[1]) {
      try {
        return JSON.parse(m[1]);
      } catch {
        /* try next */
      }
    }
  }
  const raw = between(body, "ytInitialPlayerResponse = ", ";var meta");
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function extractYtcfg(body: string): Record<string, unknown> | null {
  const m = /ytcfg\.set\s*\(\s*(\{.+?\})\s*\)\s*;/.exec(body);
  if (!m?.[1]) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

export function extractPlayerJsUrl(body: string): string | null {
  const m =
    /<script\s+src="([^"]+)"(?:\s+type="text\/javascript")?\s+name="player_ias\/base"\s*>|"jsUrl":"([^"]+)"/.exec(
      body,
    );
  const url = m?.[1] || m?.[2];
  if (!url) return null;
  return new URL(url, YT_BASE).toString();
}

export function extractSignatureTimestamp(playerJs: string): string | null {
  const m = /(signatureTimestamp|sts)\s*:\s*(\d+)/.exec(playerJs);
  return m?.[2] || null;
}

export function extractVisitorData(
  ...sources: Array<Record<string, unknown> | null | undefined>
): string | null {
  for (const src of sources) {
    if (!src) continue;
    try {
      const ctx = src.responseContext as
        | {
            serviceTrackingParams?: Array<{
              service: string;
              params: Array<{ key: string; value: string }>;
            }>;
            visitorData?: string;
          }
        | undefined;
      if (ctx?.visitorData) return ctx.visitorData;
      const gfeedback = ctx?.serviceTrackingParams?.find(x => x.service === "GFEEDBACK");
      const vd = gfeedback?.params?.find(x => x.key === "visitor_data")?.value;
      if (vd) return vd;
    } catch {
      /* continue */
    }
    const ytcfg = src as { VISITOR_DATA?: string; INNERTUBE_CONTEXT?: { client?: { visitorData?: string } } };
    if (ytcfg.VISITOR_DATA) return ytcfg.VISITOR_DATA;
    if (ytcfg.INNERTUBE_CONTEXT?.client?.visitorData) return ytcfg.INNERTUBE_CONTEXT.client.visitorData;
  }
  return null;
}

export function playabilityError(playerResponse: Record<string, unknown> | null | undefined): Error | null {
  if (!playerResponse) return null;
  const status = (playerResponse.playabilityStatus as { status?: string; reason?: string } | undefined)?.status;
  if (!status || status === "OK" || status === "LIVE_STREAM_OFFLINE") return null;
  const reason =
    (playerResponse.playabilityStatus as { reason?: string })?.reason ||
    `Playback status: ${status}`;
  return new Error(reason);
}

export async function callPlayerApi(
  request: RequestClient,
  videoId: string,
  client: string,
  opts: {
    visitorData?: string | null;
    signatureTimestamp?: string | null;
    poToken?: string | null;
    playbackContext?: Record<string, unknown>;
  } = {},
): Promise<Record<string, unknown>> {
  const cfg: InnertubeClient = getClientConfig(client);
  const ua = cfg.INNERTUBE_CONTEXT.client.userAgent as string | undefined;
  const context = structuredClone(cfg.INNERTUBE_CONTEXT);
  if (opts.visitorData) {
    (context.client as Record<string, unknown>).visitorData = opts.visitorData;
  }

  const query: Record<string, unknown> = {
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
  };

  if (opts.poToken) {
    query.serviceIntegrityDimensions = { poToken: opts.poToken };
  }

  const sts = opts.signatureTimestamp;
  query.playbackContext = opts.playbackContext || {
    contentPlaybackContext: {
      html5Preference: "HTML5_PREF_WANTS",
      ...(sts ? { signatureTimestamp: Number(sts) } : {}),
    },
  };

  const host = cfg.INNERTUBE_HOST || "www.youtube.com";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Goog-Api-Format-Version": "2",
    "X-YouTube-Client-Name": String(cfg.INNERTUBE_CONTEXT_CLIENT_NAME),
    "X-YouTube-Client-Version": String(cfg.INNERTUBE_CONTEXT.client.clientVersion),
  };
  if (ua) headers["User-Agent"] = ua;
  if (opts.visitorData) headers["X-Goog-Visitor-Id"] = opts.visitorData;

  const payload = { context, ...query };
  return request.json(`https://${host}/youtubei/v1/player`, {
    method: "POST",
    headers,
    query: { prettyPrint: "false" },
    body: JSON.stringify(payload),
  });
}

export function generateClientPlaybackNonce(length = 16): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
