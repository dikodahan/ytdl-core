import { Cookie, CookieJar, canonicalDomain } from "tough-cookie";
import { CookieAgent, cookie } from "http-cookie-agent/undici";
import { ProxyAgent, request as undiciRequest, type Dispatcher } from "undici";
import type { Agent } from "../core/types";
import {
  browserHeadersFor,
  createImpersonateTransport,
  isCloudflareChallenge,
  type ImpersonateProfile,
  type ImpersonateTransport,
} from "./cloudflare";

export interface CompatCookie {
  name?: string;
  key?: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  hostOnly?: boolean;
  sameSite?: string;
  expirationDate?: number;
}

const convertSameSite = (sameSite?: string): "strict" | "lax" | "none" => {
  switch (sameSite) {
    case "strict":
      return "strict";
    case "lax":
      return "lax";
    default:
      return "none";
  }
};

export interface CookieWriteOptions {
  /** URL used when calling jar.setCookieSync (defaults from domain or youtube) */
  url?: string;
  /** Fallback domain when a cookie has none */
  defaultDomain?: string;
  /** Inject YouTube SOCS consent cookie (default: true when domain/url is YouTube) */
  injectYoutubeSocs?: boolean;
}

function cookieSetUrl(c: CompatCookie | Cookie, opts: CookieWriteOptions = {}): string {
  if (opts.url) return opts.url;
  const domain =
    (c instanceof Cookie ? c.domain : c.domain) || opts.defaultDomain || ".youtube.com";
  const host = domain.replace(/^\./, "");
  return `https://${host}/`;
}

const convertCookie = (c: CompatCookie | Cookie, opts: CookieWriteOptions = {}): Cookie =>
  c instanceof Cookie
    ? c
    : new Cookie({
        key: c.name || c.key || "",
        value: c.value,
        expires: typeof c.expirationDate === "number" ? new Date(c.expirationDate * 1000) : "Infinity",
        domain: c.domain ? canonicalDomain(c.domain) : canonicalDomain(opts.defaultDomain || ".youtube.com"),
        path: c.path || "/",
        secure: c.secure ?? true,
        httpOnly: c.httpOnly ?? false,
        sameSite: convertSameSite(c.sameSite),
        hostOnly: c.hostOnly ?? false,
      });

export function addCookies(
  jar: CookieJar,
  cookies: Array<CompatCookie | Cookie>,
  opts: CookieWriteOptions = {},
): void {
  const defaultDomain = opts.defaultDomain || ".youtube.com";
  const isYoutube = /youtube\.com$/i.test(defaultDomain.replace(/^\./, "")) ||
    /youtube\.com/i.test(opts.url || "");
  const injectSocs = opts.injectYoutubeSocs ?? isYoutube;

  let list = cookies;
  if (
    injectSocs &&
    !list.some(c => ("name" in c && c.name === "SOCS") || ("key" in c && c.key === "SOCS"))
  ) {
    list = [
      ...list,
      {
        domain: ".youtube.com",
        hostOnly: false,
        httpOnly: false,
        name: "SOCS",
        path: "/",
        sameSite: "lax",
        secure: true,
        value: "CAI",
      },
    ];
  }
  for (const item of list) {
    const writeOpts = { ...opts, defaultDomain };
    jar.setCookieSync(convertCookie(item, writeOpts), cookieSetUrl(item, writeOpts));
  }
}

export function addCookiesFromString(
  jar: CookieJar,
  cookies: string,
  opts: CookieWriteOptions = {},
): void {
  addCookies(
    jar,
    cookies
      .split(";")
      .map(c => Cookie.parse(c.trim()))
      .filter((c): c is Cookie => !!c),
    opts,
  );
}

export function createAgent(
  cookies: Array<CompatCookie | Cookie> = [],
  opts: Record<string, unknown> & { cookieOptions?: CookieWriteOptions } = {},
): Agent {
  const options = { ...opts } as Record<string, unknown> & {
    cookies?: { jar: CookieJar };
    localAddress?: string;
    cookieOptions?: CookieWriteOptions;
  };
  if (!options.cookies) {
    const jar = new CookieJar();
    addCookies(jar, cookies, options.cookieOptions);
    options.cookies = { jar };
  }
  return {
    dispatcher: new CookieAgent(options as ConstructorParameters<typeof CookieAgent>[0]),
    localAddress: options.localAddress,
    jar: options.cookies.jar,
  };
}

export function createProxyAgent(
  proxy: string | URL,
  cookies: Array<CompatCookie | Cookie> = [],
  opts: Record<string, unknown> & { cookieOptions?: CookieWriteOptions } = {},
): Agent {
  const options = { ...opts } as Record<string, unknown> & {
    cookies?: { jar: CookieJar };
    localAddress?: string;
    cookieOptions?: CookieWriteOptions;
  };
  if (!options.cookies) {
    const jar = new CookieJar();
    addCookies(jar, cookies, options.cookieOptions);
    options.cookies = { jar };
  }
  const proxyUrl = typeof proxy === "string" ? proxy : proxy.toString();
  const { cookies: cookieOpts, localAddress, ...proxyOpts } = options;
  const dispatcher = new ProxyAgent({
    uri: proxyUrl,
    ...proxyOpts,
  }).compose(cookie({ jar: cookieOpts.jar })) as Dispatcher;

  return {
    dispatcher,
    localAddress,
    jar: cookieOpts.jar,
  };
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
  query?: Record<string, string | number | boolean | undefined | null>;
  dispatcher?: Dispatcher;
  signal?: AbortSignal;
}

export interface RequestResult {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  json<T = unknown>(): T;
}

export interface RequestClientOptions {
  agent?: Agent;
  defaultHeaders?: Record<string, string>;
  /**
   * Browser profile for headers (and for CycleTLS when bypass/force is on).
   * Does not force every request through CycleTLS — YouTube Innertube prefers Undici.
   */
  impersonate?: boolean | ImpersonateProfile;
  /** Retry Cloudflare challenge responses via CycleTLS */
  cloudflareBypass?: boolean;
  /** Route all HTTP through CycleTLS (stronger CF bypass; can break some APIs) */
  forceImpersonate?: boolean;
  proxy?: string;
}

function buildUrl(url: string, query?: RequestOptions["query"]): string {
  if (!query) return url;
  const u = new URL(url);
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    u.searchParams.set(k, String(v));
  }
  return u.toString();
}

export class RequestClient {
  readonly agent: Agent;
  readonly defaultHeaders: Record<string, string>;
  readonly proxy?: string;
  readonly cloudflareBypass: boolean;
  readonly forceImpersonate: boolean;
  private impersonateTransport: ImpersonateTransport | null = null;
  private impersonateInit: Promise<ImpersonateTransport | null> | null = null;
  private readonly impersonateProfile: ImpersonateProfile | false;

  constructor(agentOrOpts?: Agent | RequestClientOptions, defaultHeaders: Record<string, string> = {}) {
    const opts: RequestClientOptions =
      agentOrOpts && "dispatcher" in agentOrOpts
        ? { agent: agentOrOpts as Agent, defaultHeaders }
        : ((agentOrOpts as RequestClientOptions) || {});

    this.agent = opts.agent || createAgent();
    this.proxy = opts.proxy;
    this.forceImpersonate = !!opts.forceImpersonate;
    this.cloudflareBypass = opts.cloudflareBypass ?? this.forceImpersonate;

    if (opts.impersonate === false || opts.impersonate === undefined) {
      this.impersonateProfile = this.cloudflareBypass || this.forceImpersonate ? "chrome" : false;
    } else if (opts.impersonate === true) {
      this.impersonateProfile = "chrome";
    } else {
      this.impersonateProfile = opts.impersonate;
    }

    const browser = this.impersonateProfile ? browserHeadersFor(this.impersonateProfile) : {};
    this.defaultHeaders = {
      "User-Agent":
        browser["User-Agent"] ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      ...browser,
      ...opts.defaultHeaders,
      ...defaultHeaders,
    };
  }

  private async ensureImpersonate(): Promise<ImpersonateTransport | null> {
    if (!this.impersonateProfile && !this.cloudflareBypass) return null;
    if (this.impersonateTransport) return this.impersonateTransport;
    if (!this.impersonateInit) {
      this.impersonateInit = createImpersonateTransport(this.impersonateProfile || "chrome").then(t => {
        this.impersonateTransport = t;
        return t;
      });
    }
    return this.impersonateInit;
  }

  async request(url: string, options: RequestOptions = {}): Promise<RequestResult> {
    let fullUrl = buildUrl(url, options.query);
    const method = (options.method || "GET").toUpperCase();
    const maxRedirects = 10;

    for (let hop = 0; hop <= maxRedirects; hop++) {
      const headers: Record<string, string> = {
        ...this.defaultHeaders,
        ...options.headers,
      };
      const cookieHeader = this.agent.jar.getCookieStringSync(fullUrl);
      if (cookieHeader) headers.Cookie = cookieHeader;

      let result: RequestResult;
      if (this.forceImpersonate) {
        const transport = await this.ensureImpersonate();
        result = transport
          ? await this.requestViaImpersonate(transport, fullUrl, headers, options)
          : await this.requestViaUndici(fullUrl, headers, options);
      } else {
        result = await this.requestViaUndici(fullUrl, headers, options);
        if (
          this.cloudflareBypass &&
          isCloudflareChallenge(result.statusCode, result.headers, result.body)
        ) {
          const transport = await this.ensureImpersonate();
          if (transport) {
            result = await this.requestViaImpersonate(transport, fullUrl, headers, options);
          }
        }
      }

      const redirect =
        result.statusCode === 301 ||
        result.statusCode === 302 ||
        result.statusCode === 303 ||
        result.statusCode === 307 ||
        result.statusCode === 308;
      if (!redirect || hop === maxRedirects) return result;

      const location = result.headers.location;
      const loc = Array.isArray(location) ? location[0] : location;
      if (!loc) return result;

      fullUrl = new URL(loc, fullUrl).toString();
      // Convert POST → GET on classic redirects (except 307/308).
      if ((result.statusCode === 301 || result.statusCode === 302 || result.statusCode === 303) && method !== "GET" && method !== "HEAD") {
        options = { ...options, method: "GET", body: undefined };
      }
    }

    throw new Error(`Too many redirects for ${url}`);
  }

  private async requestViaUndici(
    fullUrl: string,
    headers: Record<string, string>,
    options: RequestOptions,
  ): Promise<RequestResult> {
    const res = await undiciRequest(fullUrl, {
      method: (options.method || "GET") as "GET" | "POST" | "HEAD" | "PUT" | "DELETE" | "PATCH",
      headers,
      body: options.body,
      dispatcher: options.dispatcher || this.agent.dispatcher,
      signal: options.signal,
    });

    const body = await res.body.text();
    this.persistCookies(fullUrl, res.headers["set-cookie"]);

    return {
      statusCode: res.statusCode,
      headers: res.headers as Record<string, string | string[] | undefined>,
      body,
      json<T = unknown>() {
        return JSON.parse(body) as T;
      },
    };
  }

  private async requestViaImpersonate(
    transport: ImpersonateTransport,
    fullUrl: string,
    headers: Record<string, string>,
    options: RequestOptions,
  ): Promise<RequestResult> {
    const res = await transport.request({
      url: fullUrl,
      method: options.method || "GET",
      headers,
      body: typeof options.body === "string" ? options.body : options.body?.toString("utf8"),
      proxy: this.proxy,
    });

    const setCookie = res.headers["set-cookie"] || res.headers["Set-Cookie"];
    this.persistCookies(fullUrl, setCookie);

    return {
      statusCode: res.statusCode,
      headers: res.headers,
      body: res.body,
      json<T = unknown>() {
        return JSON.parse(res.body) as T;
      },
    };
  }

  private persistCookies(url: string, setCookie: string | string[] | undefined): void {
    if (!setCookie) return;
    const list = Array.isArray(setCookie) ? setCookie : [setCookie];
    for (const c of list) {
      try {
        this.agent.jar.setCookieSync(c, url);
      } catch {
        /* ignore */
      }
    }
  }

  async text(url: string, options?: RequestOptions): Promise<string> {
    const res = await this.request(url, options);
    if (res.statusCode >= 400) {
      throw Object.assign(new Error(`HTTP ${res.statusCode} for ${url}`), {
        statusCode: res.statusCode,
        body: res.body,
      });
    }
    return res.body;
  }

  async json<T = unknown>(url: string, options?: RequestOptions): Promise<T> {
    const res = await this.request(url, options);
    if (res.statusCode >= 400) {
      throw Object.assign(new Error(`HTTP ${res.statusCode} for ${url}`), {
        statusCode: res.statusCode,
        body: res.body,
      });
    }
    return res.json<T>();
  }

  async close(): Promise<void> {
    await this.impersonateTransport?.close?.();
  }
}
