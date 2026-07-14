/**
 * Cloudflare / anti-bot helpers + optional TLS fingerprint impersonation via CycleTLS.
 *
 * CycleTLS is an optionalDependency. When unavailable, we fall back to undici with
 * browser-like headers (weaker against JA3-based CF bot scores).
 */

export type ImpersonateProfile = "chrome" | "firefox" | "safari" | "edge";

/** Chrome 120 JA3 commonly used with CycleTLS */
export const JA3_PROFILES: Record<ImpersonateProfile, string> = {
  chrome:
    "771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-17513-21,29-23-24,0",
  firefox:
    "771,4865-4867-4866-49195-49199-52393-52392-49196-49200-49162-49161-49171-49172-51-57-47-53-10,0-23-65281-10-11-35-16-5-51-43-13-45-28-21,29-23-24-25-256-257,0",
  safari:
    "771,4865-4866-4867-49196-49195-52393-49200-49199-52392-49162-49161-49172-49171-157-156-53-47-49160-49170-10,0-23-65281-10-11-16-5-13-18-51-45-43-27,29-23-24-25,0",
  edge:
    "771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-17513,29-23-24,0",
};

export const BROWSER_USER_AGENTS: Record<ImpersonateProfile, string> = {
  chrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  firefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  safari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  edge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
};

export function isCloudflareChallenge(statusCode: number, headers: Record<string, unknown>, body: string): boolean {
  const server = String(headers.server || headers.Server || "").toLowerCase();
  const cfRay = headers["cf-ray"] || headers["CF-RAY"];
  if (cfRay || server.includes("cloudflare")) {
    if (statusCode === 403 || statusCode === 503 || statusCode === 429) return true;
  }
  if (/cdn-cgi\/challenge|just a moment|cf-browser-verification|_cf_chl|Attention Required/i.test(body)) {
    return true;
  }
  return false;
}

export interface ImpersonateTransportRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  proxy?: string;
  timeoutMs?: number;
}

export interface ImpersonateTransportResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

export interface ImpersonateTransport {
  profile: ImpersonateProfile;
  available: boolean;
  backend: "cycletls" | "none";
  request(req: ImpersonateTransportRequest): Promise<ImpersonateTransportResponse>;
  close?(): Promise<void> | void;
}

type CycleTLSClient = {
  (
    url: string,
    options: Record<string, unknown>,
    method: string,
  ): Promise<{
    status: number;
    headers: Record<string, string | string[]>;
    data: string | object;
  }>;
  exit?: () => Promise<void>;
};

let cycleFactory: ((opts?: Record<string, unknown>) => Promise<CycleTLSClient>) | null | undefined;

function loadCycleTLS(): ((opts?: Record<string, unknown>) => Promise<CycleTLSClient>) | null {
  if (cycleFactory !== undefined) return cycleFactory;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("cycletls") as { default?: (opts?: Record<string, unknown>) => Promise<CycleTLSClient> } & ((
      opts?: Record<string, unknown>,
    ) => Promise<CycleTLSClient>);
    cycleFactory = (mod.default || mod) as (opts?: Record<string, unknown>) => Promise<CycleTLSClient>;
  } catch {
    cycleFactory = null;
  }
  return cycleFactory;
}

export function isImpersonateAvailable(): boolean {
  return !!loadCycleTLS();
}

export async function createImpersonateTransport(
  profile: ImpersonateProfile | boolean = "chrome",
): Promise<ImpersonateTransport | null> {
  const resolved: ImpersonateProfile = profile === true ? "chrome" : profile === false ? "chrome" : profile;
  const init = loadCycleTLS();
  if (!init) return null;

  const client = await init();
  const ja3 = JA3_PROFILES[resolved];
  const ua = BROWSER_USER_AGENTS[resolved];

  return {
    profile: resolved,
    available: true,
    backend: "cycletls",
    async request(req) {
      const headers = {
        ...req.headers,
        "User-Agent": req.headers?.["User-Agent"] || req.headers?.["user-agent"] || ua,
      };
      const response = await client(
        req.url,
        {
          body: req.body || "",
          ja3,
          userAgent: headers["User-Agent"],
          headers,
          proxy: req.proxy || "",
          timeout: req.timeoutMs || 30_000,
          disableRedirect: false,
        },
        (req.method || "GET").toUpperCase(),
      );

      const body =
        typeof response.data === "string" ? response.data : JSON.stringify(response.data ?? "");

      return {
        statusCode: response.status,
        headers: response.headers || {},
        body,
      };
    },
    async close() {
      if (typeof client.exit === "function") await client.exit();
    },
  };
}

export function browserHeadersFor(profile: ImpersonateProfile = "chrome"): Record<string, string> {
  // Keep this compatible with Innertube JSON + HTML watch pages.
  // Avoid forcing Accept/Accept-Encoding here — Undici manages decompression,
  // and API POSTs set their own Content-Type / Accept.
  return {
    "User-Agent": BROWSER_USER_AGENTS[profile],
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
  };
}
