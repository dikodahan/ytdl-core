"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PoTokenDirector = exports.ManualPoTokenProvider = exports.MemoryPoTokenCache = void 0;
exports.attachGvsPoToken = attachGvsPoToken;
/** In-memory PO token cache with simple TTL */
class MemoryPoTokenCache {
    ttlMs;
    store = new Map();
    constructor(ttlMs = 6 * 60 * 60 * 1000) {
        this.ttlMs = ttlMs;
    }
    key(req) {
        return `${req.client}.${req.context}:${req.visitorData || ""}:${req.videoId || ""}`;
    }
    get(req) {
        const entry = this.store.get(this.key(req));
        if (!entry)
            return null;
        if (Date.now() > entry.expires) {
            this.store.delete(this.key(req));
            return null;
        }
        return entry.token;
    }
    set(req, token) {
        this.store.set(this.key(req), { token, expires: Date.now() + this.ttlMs });
    }
}
exports.MemoryPoTokenCache = MemoryPoTokenCache;
/**
 * Manual tokens from params:
 * - array of "client.context+TOKEN"
 * - or map { "client.context": "TOKEN" }
 */
class ManualPoTokenProvider {
    name = "manual";
    tokens = new Map();
    constructor(input) {
        if (!input)
            return;
        if (Array.isArray(input)) {
            for (const entry of input) {
                const plus = entry.indexOf("+");
                if (plus < 0)
                    continue;
                const meta = entry.slice(0, plus);
                const token = entry.slice(plus + 1);
                const [client, context = "gvs"] = meta.split(".");
                this.tokens.set(`${client.toLowerCase()}.${context.toLowerCase()}`, token);
            }
        }
        else {
            for (const [k, v] of Object.entries(input)) {
                this.tokens.set(k.toLowerCase(), v);
            }
        }
    }
    getPoToken(req) {
        return (this.tokens.get(`${req.client.toLowerCase()}.${req.context}`) ||
            this.tokens.get(`${req.client.toLowerCase()}.gvs`) ||
            null);
    }
}
exports.ManualPoTokenProvider = ManualPoTokenProvider;
class PoTokenDirector {
    providers = [];
    cache = new MemoryPoTokenCache();
    register(provider) {
        this.providers.push(provider);
    }
    async getPoToken(req) {
        const cached = this.cache.get(req);
        if (cached)
            return cached;
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
exports.PoTokenDirector = PoTokenDirector;
/** Attach potoken query param to Google Video / stream URLs when provided */
function attachGvsPoToken(url, poToken) {
    if (!poToken || !url)
        return url;
    try {
        const u = new URL(url);
        if (!u.searchParams.has("pot")) {
            u.searchParams.set("pot", poToken);
        }
        return u.toString();
    }
    catch {
        const sep = url.includes("?") ? "&" : "?";
        return `${url}${sep}pot=${encodeURIComponent(poToken)}`;
    }
}
//# sourceMappingURL=index.js.map