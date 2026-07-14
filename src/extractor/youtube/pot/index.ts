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
export class MemoryPoTokenCache {
  private readonly store = new Map<string, { token: string; expires: number }>();
  constructor(private readonly ttlMs = 6 * 60 * 60 * 1000) {}

  key(req: PoTokenRequest): string {
    return `${req.client}.${req.context}:${req.visitorData || ""}:${req.videoId || ""}`;
  }

  get(req: PoTokenRequest): string | null {
    const entry = this.store.get(this.key(req));
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.store.delete(this.key(req));
      return null;
    }
    return entry.token;
  }

  set(req: PoTokenRequest, token: string): void {
    this.store.set(this.key(req), { token, expires: Date.now() + this.ttlMs });
  }
}

/**
 * Manual tokens from params:
 * - array of "client.context+TOKEN"
 * - or map { "client.context": "TOKEN" }
 */
export class ManualPoTokenProvider implements PoTokenProvider {
  name = "manual";
  private readonly tokens = new Map<string, string>();

  constructor(input?: string[] | Record<string, string>) {
    if (!input) return;
    if (Array.isArray(input)) {
      for (const entry of input) {
        const plus = entry.indexOf("+");
        if (plus < 0) continue;
        const meta = entry.slice(0, plus);
        const token = entry.slice(plus + 1);
        const [client, context = "gvs"] = meta.split(".");
        this.tokens.set(`${client.toLowerCase()}.${context.toLowerCase()}`, token);
      }
    } else {
      for (const [k, v] of Object.entries(input)) {
        this.tokens.set(k.toLowerCase(), v);
      }
    }
  }

  getPoToken(req: PoTokenRequest): string | null {
    return (
      this.tokens.get(`${req.client.toLowerCase()}.${req.context}`) ||
      this.tokens.get(`${req.client.toLowerCase()}.gvs`) ||
      null
    );
  }
}

export class PoTokenDirector {
  private readonly providers: PoTokenProvider[] = [];
  private readonly cache = new MemoryPoTokenCache();

  register(provider: PoTokenProvider): void {
    this.providers.push(provider);
  }

  async getPoToken(req: PoTokenRequest): Promise<string | null> {
    const cached = this.cache.get(req);
    if (cached) return cached;

    for (const provider of this.providers) {
      const token = await provider.getPoToken(req);
      if (token) {
        this.cache.set(req, token);
        return token;
      }
    }
    return null;
  }
}

/** Attach potoken query param to Google Video / stream URLs when provided */
export function attachGvsPoToken(url: string, poToken: string | null | undefined): string {
  if (!poToken || !url) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("pot")) {
      u.searchParams.set("pot", poToken);
    }
    return u.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}pot=${encodeURIComponent(poToken)}`;
  }
}
