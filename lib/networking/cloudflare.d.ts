/**
 * Cloudflare / anti-bot helpers + optional TLS fingerprint impersonation via CycleTLS.
 *
 * CycleTLS is an optionalDependency. When unavailable, we fall back to undici with
 * browser-like headers (weaker against JA3-based CF bot scores).
 */
export type ImpersonateProfile = "chrome" | "firefox" | "safari" | "edge";
/** Chrome 120 JA3 commonly used with CycleTLS */
export declare const JA3_PROFILES: Record<ImpersonateProfile, string>;
export declare const BROWSER_USER_AGENTS: Record<ImpersonateProfile, string>;
export declare function isCloudflareChallenge(statusCode: number, headers: Record<string, unknown>, body: string): boolean;
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
export declare function isImpersonateAvailable(): boolean;
export declare function createImpersonateTransport(profile?: ImpersonateProfile | boolean): Promise<ImpersonateTransport | null>;
export declare function browserHeadersFor(profile?: ImpersonateProfile): Record<string, string>;
//# sourceMappingURL=cloudflare.d.ts.map