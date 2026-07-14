"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestClient = void 0;
exports.addCookies = addCookies;
exports.addCookiesFromString = addCookiesFromString;
exports.createAgent = createAgent;
exports.createProxyAgent = createProxyAgent;
const tough_cookie_1 = require("tough-cookie");
const undici_1 = require("http-cookie-agent/undici");
const undici_2 = require("undici");
const cloudflare_1 = require("./cloudflare");
const convertSameSite = (sameSite) => {
    switch (sameSite) {
        case "strict":
            return "strict";
        case "lax":
            return "lax";
        default:
            return "none";
    }
};
function cookieSetUrl(c, opts = {}) {
    if (opts.url)
        return opts.url;
    const domain = (c instanceof tough_cookie_1.Cookie ? c.domain : c.domain) || opts.defaultDomain || ".youtube.com";
    const host = domain.replace(/^\./, "");
    return `https://${host}/`;
}
const convertCookie = (c, opts = {}) => c instanceof tough_cookie_1.Cookie
    ? c
    : new tough_cookie_1.Cookie({
        key: c.name || c.key || "",
        value: c.value,
        expires: typeof c.expirationDate === "number" ? new Date(c.expirationDate * 1000) : "Infinity",
        domain: c.domain ? (0, tough_cookie_1.canonicalDomain)(c.domain) : (0, tough_cookie_1.canonicalDomain)(opts.defaultDomain || ".youtube.com"),
        path: c.path || "/",
        secure: c.secure ?? true,
        httpOnly: c.httpOnly ?? false,
        sameSite: convertSameSite(c.sameSite),
        hostOnly: c.hostOnly ?? false,
    });
function addCookies(jar, cookies, opts = {}) {
    const defaultDomain = opts.defaultDomain || ".youtube.com";
    const isYoutube = /youtube\.com$/i.test(defaultDomain.replace(/^\./, "")) ||
        /youtube\.com/i.test(opts.url || "");
    const injectSocs = opts.injectYoutubeSocs ?? isYoutube;
    let list = cookies;
    if (injectSocs &&
        !list.some(c => ("name" in c && c.name === "SOCS") || ("key" in c && c.key === "SOCS"))) {
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
function addCookiesFromString(jar, cookies, opts = {}) {
    addCookies(jar, cookies
        .split(";")
        .map(c => tough_cookie_1.Cookie.parse(c.trim()))
        .filter((c) => !!c), opts);
}
function createAgent(cookies = [], opts = {}) {
    const options = { ...opts };
    if (!options.cookies) {
        const jar = new tough_cookie_1.CookieJar();
        addCookies(jar, cookies, options.cookieOptions);
        options.cookies = { jar };
    }
    return {
        dispatcher: new undici_1.CookieAgent(options),
        localAddress: options.localAddress,
        jar: options.cookies.jar,
    };
}
function createProxyAgent(proxy, cookies = [], opts = {}) {
    const options = { ...opts };
    if (!options.cookies) {
        const jar = new tough_cookie_1.CookieJar();
        addCookies(jar, cookies, options.cookieOptions);
        options.cookies = { jar };
    }
    const proxyUrl = typeof proxy === "string" ? proxy : proxy.toString();
    const { cookies: cookieOpts, localAddress, ...proxyOpts } = options;
    const dispatcher = new undici_2.ProxyAgent({
        uri: proxyUrl,
        ...proxyOpts,
    }).compose((0, undici_1.cookie)({ jar: cookieOpts.jar }));
    return {
        dispatcher,
        localAddress,
        jar: cookieOpts.jar,
    };
}
function buildUrl(url, query) {
    if (!query)
        return url;
    const u = new URL(url);
    for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null || v === "")
            continue;
        u.searchParams.set(k, String(v));
    }
    return u.toString();
}
class RequestClient {
    agent;
    defaultHeaders;
    proxy;
    cloudflareBypass;
    forceImpersonate;
    impersonateTransport = null;
    impersonateInit = null;
    impersonateProfile;
    constructor(agentOrOpts, defaultHeaders = {}) {
        const opts = agentOrOpts && "dispatcher" in agentOrOpts
            ? { agent: agentOrOpts, defaultHeaders }
            : (agentOrOpts || {});
        this.agent = opts.agent || createAgent();
        this.proxy = opts.proxy;
        this.forceImpersonate = !!opts.forceImpersonate;
        this.cloudflareBypass = opts.cloudflareBypass ?? this.forceImpersonate;
        if (opts.impersonate === false || opts.impersonate === undefined) {
            this.impersonateProfile = this.cloudflareBypass || this.forceImpersonate ? "chrome" : false;
        }
        else if (opts.impersonate === true) {
            this.impersonateProfile = "chrome";
        }
        else {
            this.impersonateProfile = opts.impersonate;
        }
        const browser = this.impersonateProfile ? (0, cloudflare_1.browserHeadersFor)(this.impersonateProfile) : {};
        this.defaultHeaders = {
            "User-Agent": browser["User-Agent"] ||
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            ...browser,
            ...opts.defaultHeaders,
            ...defaultHeaders,
        };
    }
    async ensureImpersonate() {
        if (!this.impersonateProfile && !this.cloudflareBypass)
            return null;
        if (this.impersonateTransport)
            return this.impersonateTransport;
        if (!this.impersonateInit) {
            this.impersonateInit = (0, cloudflare_1.createImpersonateTransport)(this.impersonateProfile || "chrome").then(t => {
                this.impersonateTransport = t;
                return t;
            });
        }
        return this.impersonateInit;
    }
    async request(url, options = {}) {
        let fullUrl = buildUrl(url, options.query);
        const method = (options.method || "GET").toUpperCase();
        const maxRedirects = 10;
        for (let hop = 0; hop <= maxRedirects; hop++) {
            const headers = {
                ...this.defaultHeaders,
                ...options.headers,
            };
            const cookieHeader = this.agent.jar.getCookieStringSync(fullUrl);
            if (cookieHeader)
                headers.Cookie = cookieHeader;
            let result;
            if (this.forceImpersonate) {
                const transport = await this.ensureImpersonate();
                result = transport
                    ? await this.requestViaImpersonate(transport, fullUrl, headers, options)
                    : await this.requestViaUndici(fullUrl, headers, options);
            }
            else {
                result = await this.requestViaUndici(fullUrl, headers, options);
                if (this.cloudflareBypass &&
                    (0, cloudflare_1.isCloudflareChallenge)(result.statusCode, result.headers, result.body)) {
                    const transport = await this.ensureImpersonate();
                    if (transport) {
                        result = await this.requestViaImpersonate(transport, fullUrl, headers, options);
                    }
                }
            }
            const redirect = result.statusCode === 301 ||
                result.statusCode === 302 ||
                result.statusCode === 303 ||
                result.statusCode === 307 ||
                result.statusCode === 308;
            if (!redirect || hop === maxRedirects)
                return result;
            const location = result.headers.location;
            const loc = Array.isArray(location) ? location[0] : location;
            if (!loc)
                return result;
            fullUrl = new URL(loc, fullUrl).toString();
            // Convert POST → GET on classic redirects (except 307/308).
            if ((result.statusCode === 301 || result.statusCode === 302 || result.statusCode === 303) && method !== "GET" && method !== "HEAD") {
                options = { ...options, method: "GET", body: undefined };
            }
        }
        throw new Error(`Too many redirects for ${url}`);
    }
    async requestViaUndici(fullUrl, headers, options) {
        const res = await (0, undici_2.request)(fullUrl, {
            method: (options.method || "GET"),
            headers,
            body: options.body,
            dispatcher: options.dispatcher || this.agent.dispatcher,
            signal: options.signal,
        });
        const body = await res.body.text();
        this.persistCookies(fullUrl, res.headers["set-cookie"]);
        return {
            statusCode: res.statusCode,
            headers: res.headers,
            body,
            json() {
                return JSON.parse(body);
            },
        };
    }
    async requestViaImpersonate(transport, fullUrl, headers, options) {
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
            json() {
                return JSON.parse(res.body);
            },
        };
    }
    persistCookies(url, setCookie) {
        if (!setCookie)
            return;
        const list = Array.isArray(setCookie) ? setCookie : [setCookie];
        for (const c of list) {
            try {
                this.agent.jar.setCookieSync(c, url);
            }
            catch {
                /* ignore */
            }
        }
    }
    async text(url, options) {
        const res = await this.request(url, options);
        if (res.statusCode >= 400) {
            throw Object.assign(new Error(`HTTP ${res.statusCode} for ${url}`), {
                statusCode: res.statusCode,
                body: res.body,
            });
        }
        return res.body;
    }
    async json(url, options) {
        const res = await this.request(url, options);
        if (res.statusCode >= 400) {
            throw Object.assign(new Error(`HTTP ${res.statusCode} for ${url}`), {
                statusCode: res.statusCode,
                body: res.body,
            });
        }
        return res.json();
    }
    async close() {
        await this.impersonateTransport?.close?.();
    }
}
exports.RequestClient = RequestClient;
//# sourceMappingURL=request.js.map