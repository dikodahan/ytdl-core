export type PoTokenContext = "gvs" | "player" | "subs";
export interface PoTokenRequest {
    client: string;
    context: PoTokenContext;
    videoId?: string;
    visitorData?: string | null;
}
export interface PoTokenProvider {
    name: string;
    getPoToken(req: PoTokenRequest): Promise<string | null> | string | null;
}
/** In-memory PO token cache with simple TTL */
export declare class MemoryPoTokenCache {
    private readonly ttlMs;
    private readonly store;
    constructor(ttlMs?: number);
    key(req: PoTokenRequest): string;
    get(req: PoTokenRequest): string | null;
    set(req: PoTokenRequest, token: string): void;
}
/**
 * Manual tokens from params:
 * - array of "client.context+TOKEN"
 * - or map { "client.context": "TOKEN" }
 */
export declare class ManualPoTokenProvider implements PoTokenProvider {
    name: string;
    private readonly tokens;
    constructor(input?: string[] | Record<string, string>);
    getPoToken(req: PoTokenRequest): string | null;
}
export declare class PoTokenDirector {
    private readonly providers;
    private readonly cache;
    register(provider: PoTokenProvider): void;
    getPoToken(req: PoTokenRequest): Promise<string | null>;
}
/** Attach potoken query param to Google Video / stream URLs when provided */
export declare function attachGvsPoToken(url: string, poToken: string | null | undefined): string;
//# sourceMappingURL=index.d.ts.map