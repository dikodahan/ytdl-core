import { Cookie, CookieJar } from "tough-cookie";
import { type Dispatcher } from "undici";
import type { Agent } from "../core/types";
import { type ImpersonateProfile } from "./cloudflare";
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
export interface CookieWriteOptions {
    /** URL used when calling jar.setCookieSync (defaults from domain or youtube) */
    url?: string;
    /** Fallback domain when a cookie has none */
    defaultDomain?: string;
    /** Inject YouTube SOCS consent cookie (default: true when domain/url is YouTube) */
    injectYoutubeSocs?: boolean;
}
export declare function addCookies(jar: CookieJar, cookies: Array<CompatCookie | Cookie>, opts?: CookieWriteOptions): void;
export declare function addCookiesFromString(jar: CookieJar, cookies: string, opts?: CookieWriteOptions): void;
export declare function createAgent(cookies?: Array<CompatCookie | Cookie>, opts?: Record<string, unknown> & {
    cookieOptions?: CookieWriteOptions;
}): Agent;
export declare function createProxyAgent(proxy: string | URL, cookies?: Array<CompatCookie | Cookie>, opts?: Record<string, unknown> & {
    cookieOptions?: CookieWriteOptions;
}): Agent;
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
export declare class RequestClient {
    readonly agent: Agent;
    readonly defaultHeaders: Record<string, string>;
    readonly proxy?: string;
    readonly cloudflareBypass: boolean;
    readonly forceImpersonate: boolean;
    private impersonateTransport;
    private impersonateInit;
    private readonly impersonateProfile;
    constructor(agentOrOpts?: Agent | RequestClientOptions, defaultHeaders?: Record<string, string>);
    private ensureImpersonate;
    request(url: string, options?: RequestOptions): Promise<RequestResult>;
    private requestViaUndici;
    private requestViaImpersonate;
    private persistCookies;
    text(url: string, options?: RequestOptions): Promise<string>;
    json<T = unknown>(url: string, options?: RequestOptions): Promise<T>;
    close(): Promise<void>;
}
//# sourceMappingURL=request.d.ts.map