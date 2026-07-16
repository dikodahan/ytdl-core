"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverKalturaOttPartner = discoverKalturaOttPartner;
exports.scrapePartnerCandidates = scrapePartnerCandidates;
const presets_1 = require("./presets");
const PARTNER_ID_RE = /\b(?:partnerId|partner_id|pId|pid)["'\s:=]+(\d{3,7})\b/gi;
const HOST_PREFIX_RE = /\b(\d{3,7})\.frp1\.ott\.kaltura\.com/gi;
const IMAGE_PARTNER_RE = /GetImage\/p\/(\d{3,7})\//gi;
const LINEUP_RE = /\bidEqual["'\s:=]+(\d{4,8})\b/gi;
const APP_NAME_RE = /\b(com\.kaltura\.[a-z0-9._-]+)/gi;
const OTT_HOST_RE = /https?:\/\/[^"'`\s]*frp1\.ott\.kaltura\.com[^"'`\s]*/gi;
const DOMAIN_HINTS = [
    { pattern: /reshet/i, partnerId: 5031, label: "domain hint (reshet)" },
    { pattern: /cellcom/i, partnerId: 3197, label: "domain hint (cellcom)" },
    { pattern: /13tv|channel13|ch13/i, partnerId: 5031, label: "domain hint (channel 13 / reshet)" },
];
async function discoverKalturaOttPartner(request, inputUrl, options = {}) {
    const started = Date.now();
    const notes = [];
    const maxScripts = options.maxScripts ?? 6;
    const deepScanLimit = options.deepScanLimit ?? 120;
    const maxCandidates = options.maxCandidates ?? 20;
    const fetchTimeoutMs = options.fetchTimeoutMs ?? 15_000;
    let pageUrl;
    try {
        pageUrl = normalizePageUrl(inputUrl);
    }
    catch {
        return emptyResult(inputUrl, "", started, ["Invalid URL — enter a full https:// provider homepage."]);
    }
    const domain = pageUrl.hostname;
    const candidateMap = new Map();
    for (const hint of DOMAIN_HINTS) {
        if (hint.pattern.test(domain) || hint.pattern.test(inputUrl)) {
            addCandidate(candidateMap, hint.partnerId, hint.label, 4);
        }
    }
    let html = "";
    try {
        html = await fetchText(request, pageUrl.toString(), pageUrl.origin, fetchTimeoutMs);
        extractCandidatesFromText(html, "page HTML", candidateMap);
    }
    catch (err) {
        notes.push(`Could not fetch page: ${err instanceof Error ? err.message : String(err)}`);
    }
    const scriptUrls = extractScriptUrls(html, pageUrl).slice(0, maxScripts);
    let scannedScripts = 0;
    for (const scriptUrl of scriptUrls) {
        try {
            const js = await fetchText(request, scriptUrl, pageUrl.origin, fetchTimeoutMs);
            extractCandidatesFromText(js, `script ${shortUrl(scriptUrl)}`, candidateMap);
            scannedScripts++;
        }
        catch {
            /* ignore individual script failures */
        }
    }
    const candidates = [...candidateMap.values()]
        .sort((a, b) => b.weight - a.weight)
        .slice(0, maxCandidates);
    if (candidateMap.size > maxCandidates) {
        notes.push(`Probing top ${maxCandidates} of ${candidateMap.size} scraped candidates.`);
    }
    const hits = [];
    let probesAttempted = 0;
    for (const c of candidates) {
        probesAttempted++;
        const hit = await probePartner(request, c);
        if (hit)
            hits.push(hit);
    }
    if (!hits.some(h => h.confidence === "verified") && options.deepScan) {
        notes.push(`Deep scan: probing up to ${deepScanLimit} partner IDs…`);
        const tried = new Set(candidates.map(c => c.partnerId));
        for (let id = 2500; id <= 5500 && probesAttempted < deepScanLimit; id++) {
            if (tried.has(id))
                continue;
            tried.add(id);
            probesAttempted++;
            const hit = await probePartner(request, {
                partnerId: id,
                source: "deep scan probe",
                weight: 0,
            });
            if (hit?.confidence === "verified") {
                hits.push(hit);
                notes.push(`Deep scan found partner ${id} after ${probesAttempted} probes.`);
                break;
            }
        }
        if (!hits.some(h => h.confidence === "verified")) {
            notes.push("Deep scan did not find a working partner ID in the scanned range.");
        }
    }
    hits.sort((a, b) => rankConfidence(b.confidence) - rankConfidence(a.confidence));
    const dedupedHits = dedupeHits(hits);
    return {
        ok: dedupedHits.some(h => h.confidence === "verified"),
        inputUrl,
        domain,
        hits: dedupedHits,
        candidates: candidates.map(c => c.partnerId),
        scannedScripts,
        probesAttempted,
        elapsedMs: Date.now() - started,
        notes,
    };
}
function emptyResult(inputUrl, domain, started, notes) {
    return {
        ok: false,
        inputUrl,
        domain,
        hits: [],
        candidates: [],
        scannedScripts: 0,
        probesAttempted: 0,
        elapsedMs: Date.now() - started,
        notes,
    };
}
function normalizePageUrl(raw) {
    const trimmed = raw.trim();
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProto);
    if (!url.hostname)
        throw new Error("missing hostname");
    return url;
}
async function fetchText(request, url, referer, timeoutMs) {
    const signal = typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
        ? AbortSignal.timeout(timeoutMs)
        : undefined;
    return request.text(url, {
        signal,
        headers: {
            Accept: "text/html,application/xhtml+xml,application/json,text/plain,*/*",
            Referer: referer,
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        },
    });
}
function extractScriptUrls(html, base) {
    const out = [];
    const re = /<script[^>]+src=["']([^"']+)["']/gi;
    let m;
    while ((m = re.exec(html))) {
        try {
            out.push(new URL(m[1], base).toString());
        }
        catch {
            /* skip */
        }
    }
    return [...new Set(out)];
}
function extractCandidatesFromText(text, source, map) {
    scanRegex(text, PARTNER_ID_RE, 5, source, map);
    scanRegex(text, HOST_PREFIX_RE, 6, source, map);
    scanRegex(text, IMAGE_PARTNER_RE, 4, source, map);
    for (const m of text.matchAll(LINEUP_RE)) {
        const lineupId = Number(m[1]);
        if (!Number.isFinite(lineupId))
            continue;
        for (const id of [...map.keys()]) {
            const prev = map.get(id);
            if (prev && !prev.lineupId) {
                map.set(id, { ...prev, lineupId });
            }
        }
    }
    for (const m of text.matchAll(APP_NAME_RE)) {
        const app = m[1];
        for (const id of [...map.keys()]) {
            const prev = map.get(id);
            if (prev && !prev.applicationName) {
                map.set(id, { ...prev, applicationName: app });
            }
        }
    }
    for (const m of text.matchAll(OTT_HOST_RE)) {
        scanRegex(m[0], HOST_PREFIX_RE, 6, `${source} (ott url)`, map);
    }
}
function scanRegex(text, re, weight, source, map) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
        const partnerId = Number(m[1]);
        if (!Number.isFinite(partnerId) || partnerId < 100 || partnerId > 9_999_999)
            continue;
        addCandidate(map, partnerId, source, weight);
    }
}
function addCandidate(map, partnerId, source, weight, extra = {}) {
    const prev = map.get(partnerId);
    if (prev) {
        map.set(partnerId, {
            ...prev,
            ...extra,
            weight: prev.weight + weight,
            source: prev.source.includes(source) ? prev.source : `${prev.source}; ${source}`,
        });
    }
    else {
        map.set(partnerId, { partnerId, source, weight, ...extra });
    }
}
async function probePartner(request, candidate) {
    const loginAttempts = buildLoginAttempts(candidate.partnerId);
    for (const attempt of loginAttempts) {
        try {
            const res = await request.request(attempt.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    "User-Agent": "okhttp/5.0.0-alpha.6",
                },
                body: JSON.stringify(attempt.body),
            });
            if (res.statusCode >= 400)
                continue;
            const data = res.json();
            if (!data.result?.ks)
                continue;
            let lineupId = candidate.lineupId || presetLineup(candidate.partnerId);
            let channelCount;
            if (lineupId) {
                channelCount = await probeChannelCount(request, attempt, data.result.ks, lineupId);
            }
            return {
                partnerId: candidate.partnerId,
                confidence: "verified",
                source: candidate.source,
                apiHost: attempt.apiHost,
                loginPath: attempt.loginPath,
                apiVersion: attempt.apiVersion,
                lineupId,
                channelCount,
                applicationName: candidate.applicationName,
                sampleUrl: lineupId
                    ? `kaltura-ott:${candidate.partnerId}:lineup:${lineupId}`
                    : `kaltura-ott:${candidate.partnerId}:channels`,
            };
        }
        catch {
            /* try next login variant */
        }
    }
    if (candidate.weight >= 4) {
        return {
            partnerId: candidate.partnerId,
            confidence: "likely",
            source: candidate.source,
            sampleUrl: `kaltura-ott:${candidate.partnerId}:channels`,
        };
    }
    return null;
}
function presetLineup(partnerId) {
    const preset = Object.values(presets_1.KALTURA_OTT_PRESETS).find(p => p.partnerId === partnerId);
    return preset?.defaultLineupId || undefined;
}
function buildLoginAttempts(partnerId) {
    const udid = "405373f4b02c0b23";
    const hosts = [
        `https://${partnerId}.frp1.ott.kaltura.com`,
        "https://api.frp1.ott.kaltura.com",
    ];
    const attempts = [];
    for (const apiHost of hosts) {
        for (const [loginPath, apiVersion, bodyExtra] of [
            [
                "/api_v3/service/ottuser/action/anonymousLogin",
                "8.5.0.30179",
                { ignoreNull: true, format: 1, clientTag: "java:23-02-06" },
            ],
            [
                "/api_v3/service/OTTUser/action/anonymousLogin",
                "5.4.0.28193",
                { clientTag: "2500009-Android" },
            ],
        ]) {
            attempts.push({
                url: `${apiHost}${loginPath}`,
                apiHost,
                loginPath,
                apiVersion,
                body: {
                    partnerId,
                    udid,
                    apiVersion,
                    ...bodyExtra,
                },
            });
        }
    }
    return attempts;
}
async function probeChannelCount(request, login, ks, lineupId) {
    const listUrl = `${login.apiHost}/api_v3/service/asset/action/list`;
    const body = {
        apiVersion: login.apiVersion,
        clientTag: login.body.clientTag || "java:23-02-06",
        ks,
        filter: {
            objectType: "KalturaChannelFilter",
            idEqual: lineupId,
        },
        pager: { pageIndex: 1, pageSize: 1 },
        ignoreNull: true,
        format: 1,
    };
    try {
        const data = await request.json(listUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "User-Agent": "okhttp/5.0.0-alpha.6" },
            body: JSON.stringify(body),
        });
        return data.result?.totalCount;
    }
    catch {
        return undefined;
    }
}
function rankConfidence(c) {
    if (c === "verified")
        return 3;
    if (c === "likely")
        return 2;
    return 1;
}
function dedupeHits(hits) {
    const byId = new Map();
    for (const hit of hits) {
        const prev = byId.get(hit.partnerId);
        if (!prev || rankConfidence(hit.confidence) > rankConfidence(prev.confidence)) {
            byId.set(hit.partnerId, hit);
        }
    }
    return [...byId.values()].sort((a, b) => rankConfidence(b.confidence) - rankConfidence(a.confidence));
}
function shortUrl(url) {
    try {
        const u = new URL(url);
        return u.pathname.split("/").pop() || u.pathname;
    }
    catch {
        return url.slice(0, 40);
    }
}
/** Exported for unit tests — parse partner ids from arbitrary text. */
function scrapePartnerCandidates(text) {
    const map = new Map();
    extractCandidatesFromText(text, "test", map);
    return [...map.keys()].sort((a, b) => (map.get(b)?.weight || 0) - (map.get(a)?.weight || 0));
}
//# sourceMappingURL=discover.js.map