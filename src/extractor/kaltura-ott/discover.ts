import type { RequestClient } from "../../networking/request";
import { KALTURA_OTT_PRESETS } from "./presets";

export type PartnerConfidence = "verified" | "likely" | "guess";

export interface PartnerDiscoveryHit {
  partnerId: number;
  confidence: PartnerConfidence;
  source: string;
  apiHost?: string;
  loginPath?: string;
  apiVersion?: string;
  lineupId?: number;
  channelCount?: number;
  applicationName?: string;
  sampleUrl: string;
}

export interface DiscoverKalturaOttOptions {
  /** Probe partner IDs sequentially when scrape finds nothing (default false). */
  deepScan?: boolean;
  /** Max login probes during deep scan (default 120). */
  deepScanLimit?: number;
  /** Max linked script files to fetch (default 6). */
  maxScripts?: number;
  /** Max scraped candidates to login-probe (default 20). */
  maxCandidates?: number;
  /** Page/script fetch timeout in ms (default 15000). */
  fetchTimeoutMs?: number;
}

export interface DiscoverKalturaOttResult {
  ok: boolean;
  inputUrl: string;
  domain: string;
  hits: PartnerDiscoveryHit[];
  candidates: number[];
  scannedScripts: number;
  probesAttempted: number;
  elapsedMs: number;
  notes: string[];
}

interface CandidateMeta {
  partnerId: number;
  source: string;
  lineupId?: number;
  applicationName?: string;
  weight: number;
}

const PARTNER_ID_RE =
  /\b(?:partnerId|partner_id|pId|pid)["'\s:=]+(\d{3,7})\b/gi;
const HOST_PREFIX_RE = /\b(\d{3,7})\.frp1\.ott\.kaltura\.com/gi;
const IMAGE_PARTNER_RE = /GetImage\/p\/(\d{3,7})\//gi;
const LINEUP_RE = /\bidEqual["'\s:=]+(\d{4,8})\b/gi;
const APP_NAME_RE = /\b(com\.kaltura\.[a-z0-9._-]+)/gi;
const OTT_HOST_RE = /https?:\/\/[^"'`\s]*frp1\.ott\.kaltura\.com[^"'`\s]*/gi;

const DOMAIN_HINTS: Array<{ pattern: RegExp; partnerId: number; label: string }> = [
  { pattern: /reshet/i, partnerId: 5031, label: "domain hint (reshet)" },
  { pattern: /cellcom/i, partnerId: 3197, label: "domain hint (cellcom)" },
  { pattern: /13tv|channel13|ch13/i, partnerId: 5031, label: "domain hint (channel 13 / reshet)" },
];

export async function discoverKalturaOttPartner(
  request: RequestClient,
  inputUrl: string,
  options: DiscoverKalturaOttOptions = {},
): Promise<DiscoverKalturaOttResult> {
  const started = Date.now();
  const notes: string[] = [];
  const maxScripts = options.maxScripts ?? 6;
  const deepScanLimit = options.deepScanLimit ?? 120;
  const maxCandidates = options.maxCandidates ?? 20;
  const fetchTimeoutMs = options.fetchTimeoutMs ?? 15_000;

  let pageUrl: URL;
  try {
    pageUrl = normalizePageUrl(inputUrl);
  } catch {
    return emptyResult(inputUrl, "", started, ["Invalid URL — enter a full https:// provider homepage."]);
  }

  const domain = pageUrl.hostname;
  const candidateMap = new Map<number, CandidateMeta>();

  for (const hint of DOMAIN_HINTS) {
    if (hint.pattern.test(domain) || hint.pattern.test(inputUrl)) {
      addCandidate(candidateMap, hint.partnerId, hint.label, 4);
    }
  }

  let html = "";
  try {
    html = await fetchText(request, pageUrl.toString(), pageUrl.origin, fetchTimeoutMs);
    extractCandidatesFromText(html, "page HTML", candidateMap);
  } catch (err) {
    notes.push(`Could not fetch page: ${err instanceof Error ? err.message : String(err)}`);
  }

  const scriptUrls = extractScriptUrls(html, pageUrl).slice(0, maxScripts);
  let scannedScripts = 0;
  for (const scriptUrl of scriptUrls) {
    try {
      const js = await fetchText(request, scriptUrl, pageUrl.origin, fetchTimeoutMs);
      extractCandidatesFromText(js, `script ${shortUrl(scriptUrl)}`, candidateMap);
      scannedScripts++;
    } catch {
      /* ignore individual script failures */
    }
  }

  const candidates = [...candidateMap.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxCandidates);
  if (candidateMap.size > maxCandidates) {
    notes.push(`Probing top ${maxCandidates} of ${candidateMap.size} scraped candidates.`);
  }
  const hits: PartnerDiscoveryHit[] = [];
  let probesAttempted = 0;

  for (const c of candidates) {
    probesAttempted++;
    const hit = await probePartner(request, c);
    if (hit) hits.push(hit);
  }

  if (!hits.some(h => h.confidence === "verified") && options.deepScan) {
    notes.push(`Deep scan: probing up to ${deepScanLimit} partner IDs…`);
    const tried = new Set(candidates.map(c => c.partnerId));
    for (let id = 2500; id <= 5500 && probesAttempted < deepScanLimit; id++) {
      if (tried.has(id)) continue;
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

function emptyResult(
  inputUrl: string,
  domain: string,
  started: number,
  notes: string[],
): DiscoverKalturaOttResult {
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

function normalizePageUrl(raw: string): URL {
  const trimmed = raw.trim();
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProto);
  if (!url.hostname) throw new Error("missing hostname");
  return url;
}

async function fetchText(
  request: RequestClient,
  url: string,
  referer: string,
  timeoutMs: number,
): Promise<string> {
  const signal =
    typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(timeoutMs)
      : undefined;
  return request.text(url, {
    signal,
    headers: {
      Accept: "text/html,application/xhtml+xml,application/json,text/plain,*/*",
      Referer: referer,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    },
  });
}

function extractScriptUrls(html: string, base: URL): string[] {
  const out: string[] = [];
  const re = /<script[^>]+src=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      out.push(new URL(m[1], base).toString());
    } catch {
      /* skip */
    }
  }
  return [...new Set(out)];
}

function extractCandidatesFromText(
  text: string,
  source: string,
  map: Map<number, CandidateMeta>,
): void {
  scanRegex(text, PARTNER_ID_RE, 5, source, map);
  scanRegex(text, HOST_PREFIX_RE, 6, source, map);
  scanRegex(text, IMAGE_PARTNER_RE, 4, source, map);

  for (const m of text.matchAll(LINEUP_RE)) {
    const lineupId = Number(m[1]);
    if (!Number.isFinite(lineupId)) continue;
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

function scanRegex(
  text: string,
  re: RegExp,
  weight: number,
  source: string,
  map: Map<number, CandidateMeta>,
): void {
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const partnerId = Number(m[1]);
    if (!Number.isFinite(partnerId) || partnerId < 100 || partnerId > 9_999_999) continue;
    addCandidate(map, partnerId, source, weight);
  }
}

function addCandidate(
  map: Map<number, CandidateMeta>,
  partnerId: number,
  source: string,
  weight: number,
  extra: Partial<CandidateMeta> = {},
): void {
  const prev = map.get(partnerId);
  if (prev) {
    map.set(partnerId, {
      ...prev,
      ...extra,
      weight: prev.weight + weight,
      source: prev.source.includes(source) ? prev.source : `${prev.source}; ${source}`,
    });
  } else {
    map.set(partnerId, { partnerId, source, weight, ...extra });
  }
}

async function probePartner(
  request: RequestClient,
  candidate: CandidateMeta,
): Promise<PartnerDiscoveryHit | null> {
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
      if (res.statusCode >= 400) continue;
      const data = res.json<{ result?: { ks?: string } }>();
      if (!data.result?.ks) continue;

      let lineupId = candidate.lineupId || presetLineup(candidate.partnerId);
      let channelCount: number | undefined;
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
    } catch {
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

function presetLineup(partnerId: number): number | undefined {
  const preset = Object.values(KALTURA_OTT_PRESETS).find(p => p.partnerId === partnerId);
  return preset?.defaultLineupId || undefined;
}

function buildLoginAttempts(partnerId: number): Array<{
  url: string;
  apiHost: string;
  loginPath: string;
  apiVersion: string;
  body: Record<string, unknown>;
}> {
  const udid = "405373f4b02c0b23";
  const hosts = [
    `https://${partnerId}.frp1.ott.kaltura.com`,
    "https://api.frp1.ott.kaltura.com",
  ];

  const attempts: Array<{
    url: string;
    apiHost: string;
    loginPath: string;
    apiVersion: string;
    body: Record<string, unknown>;
  }> = [];

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
    ] as const) {
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

async function probeChannelCount(
  request: RequestClient,
  login: { apiHost: string; apiVersion: string; body: Record<string, unknown> },
  ks: string,
  lineupId: number,
): Promise<number | undefined> {
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
    const data = await request.json<{ result?: { totalCount?: number } }>(listUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "okhttp/5.0.0-alpha.6" },
      body: JSON.stringify(body),
    });
    return data.result?.totalCount;
  } catch {
    return undefined;
  }
}

function rankConfidence(c: PartnerConfidence): number {
  if (c === "verified") return 3;
  if (c === "likely") return 2;
  return 1;
}

function dedupeHits(hits: PartnerDiscoveryHit[]): PartnerDiscoveryHit[] {
  const byId = new Map<number, PartnerDiscoveryHit>();
  for (const hit of hits) {
    const prev = byId.get(hit.partnerId);
    if (!prev || rankConfidence(hit.confidence) > rankConfidence(prev.confidence)) {
      byId.set(hit.partnerId, hit);
    }
  }
  return [...byId.values()].sort((a, b) => rankConfidence(b.confidence) - rankConfidence(a.confidence));
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.split("/").pop() || u.pathname;
  } catch {
    return url.slice(0, 40);
  }
}

/** Exported for unit tests — parse partner ids from arbitrary text. */
export function scrapePartnerCandidates(text: string): number[] {
  const map = new Map<number, CandidateMeta>();
  extractCandidatesFromText(text, "test", map);
  return [...map.keys()].sort((a, b) => (map.get(b)?.weight || 0) - (map.get(a)?.weight || 0));
}
