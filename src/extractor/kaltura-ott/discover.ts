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
  /**
   * Probe partner IDs sequentially when app hints find nothing (default true
   * for unknown Android package names).
   */
  deepScan?: boolean;
  /** Max login probes during deep scan (default 120). */
  deepScanLimit?: number;
}

export interface DiscoverKalturaOttResult {
  ok: boolean;
  /** Android applicationId / package FQDN that was queried. */
  applicationName: string;
  /** @deprecated Alias of applicationName for older clients. */
  inputUrl: string;
  hits: PartnerDiscoveryHit[];
  candidates: number[];
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

/** Known Android package → partner mappings (from Cellcom / Reshet reference apps). */
const APP_FQDN_HINTS: Array<{
  applicationName: string;
  partnerId: number;
  label: string;
  lineupId?: number;
}> = [
  {
    applicationName: "com.cellcom.cellcomtv",
    partnerId: 3197,
    label: "known app (com.cellcom.cellcomtv)",
    lineupId: 353891,
  },
  {
    applicationName: "com.kaltura.reshet.atv",
    partnerId: 5031,
    label: "known app (com.kaltura.reshet.atv)",
    lineupId: 360478,
  },
];

const PACKAGE_KEYWORD_HINTS: Array<{ pattern: RegExp; partnerId: number; label: string }> = [
  { pattern: /cellcom/i, partnerId: 3197, label: "package keyword (cellcom)" },
  { pattern: /reshet/i, partnerId: 5031, label: "package keyword (reshet)" },
  { pattern: /13tv|channel13|ch13/i, partnerId: 5031, label: "package keyword (channel 13)" },
];

const ANDROID_PACKAGE_RE = /^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+$/;

export function normalizeAndroidApplicationName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Android app FQDN is required");
  if (/^https?:\/\//i.test(trimmed)) {
    throw new Error(
      `Invalid Android app FQDN "${raw}". Enter a package name like com.cellcom.cellcomtv, not a website URL.`,
    );
  }
  // Allow accidental "package:com.foo.bar" paste from adb / Play Console.
  const withoutScheme = trimmed.replace(/^package:/i, "").trim();
  if (!ANDROID_PACKAGE_RE.test(withoutScheme)) {
    throw new Error(
      `Invalid Android app FQDN "${raw}". Expected a package name like com.cellcom.cellcomtv`,
    );
  }
  return withoutScheme;
}

export async function discoverKalturaOttPartner(
  request: RequestClient,
  applicationNameOrUrl: string,
  options: DiscoverKalturaOttOptions = {},
): Promise<DiscoverKalturaOttResult> {
  const started = Date.now();
  const notes: string[] = [];
  const deepScanLimit = options.deepScanLimit ?? 120;

  let applicationName: string;
  try {
    applicationName = normalizeAndroidApplicationName(applicationNameOrUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return emptyResult(applicationNameOrUrl.trim(), started, [message]);
  }

  const candidateMap = new Map<number, CandidateMeta>();

  for (const hint of APP_FQDN_HINTS) {
    if (hint.applicationName.toLowerCase() === applicationName.toLowerCase()) {
      addCandidate(candidateMap, hint.partnerId, hint.label, 10, {
        applicationName,
        lineupId: hint.lineupId,
      });
    }
  }

  for (const preset of Object.values(KALTURA_OTT_PRESETS)) {
    const presetApp = preset.deviceConfig?.applicationName;
    if (presetApp && presetApp.toLowerCase() === applicationName.toLowerCase()) {
      addCandidate(candidateMap, preset.partnerId, `preset deviceConfig (${preset.alias})`, 10, {
        applicationName,
        lineupId: preset.defaultLineupId || undefined,
      });
    }
  }

  for (const hint of PACKAGE_KEYWORD_HINTS) {
    if (hint.pattern.test(applicationName)) {
      addCandidate(candidateMap, hint.partnerId, hint.label, 4, { applicationName });
    }
  }

  const knownHit = candidateMap.size > 0;
  const deepScan = options.deepScan === true || (!knownHit && options.deepScan !== false);
  if (!knownHit) {
    notes.push(
      `No built-in mapping for ${applicationName}; probing anonymousLogin to identify partner ID.`,
    );
  }

  const candidates = [...candidateMap.values()].sort((a, b) => b.weight - a.weight);
  const hits: PartnerDiscoveryHit[] = [];
  let probesAttempted = 0;

  for (const c of candidates) {
    probesAttempted++;
    const hit = await probePartner(request, { ...c, applicationName }, applicationName);
    if (hit) hits.push(hit);
  }

  const hasVerified = () => hits.some(h => h.confidence === "verified");

  if (!hasVerified() && deepScan) {
    notes.push(`Deep scan: probing up to ${deepScanLimit} partner IDs via anonymousLogin…`);
    const tried = new Set(candidates.map(c => c.partnerId));
    for (let id = 2500; id <= 5500 && probesAttempted < deepScanLimit; id++) {
      if (tried.has(id)) continue;
      tried.add(id);
      probesAttempted++;
      const hit = await probePartner(
        request,
        {
          partnerId: id,
          source: "deep scan anonymousLogin",
          weight: 0,
          applicationName,
        },
        applicationName,
      );
      if (hit?.confidence === "verified") {
        hits.push(hit);
        notes.push(`Deep scan found partner ${id} after ${probesAttempted} probes.`);
        break;
      }
    }
    if (!hasVerified()) {
      notes.push("Deep scan did not find a working partner ID in the scanned range.");
    }
  }

  hits.sort((a, b) => rankConfidence(b.confidence) - rankConfidence(a.confidence));
  const dedupedHits = dedupeHits(hits);

  return {
    ok: dedupedHits.some(h => h.confidence === "verified"),
    applicationName,
    inputUrl: applicationName,
    hits: dedupedHits,
    candidates: candidates.map(c => c.partnerId),
    probesAttempted,
    elapsedMs: Date.now() - started,
    notes,
  };
}

function emptyResult(
  applicationName: string,
  started: number,
  notes: string[],
): DiscoverKalturaOttResult {
  return {
    ok: false,
    applicationName,
    inputUrl: applicationName,
    hits: [],
    candidates: [],
    probesAttempted: 0,
    elapsedMs: Date.now() - started,
    notes,
  };
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
  applicationName: string,
): Promise<PartnerDiscoveryHit | null> {
  const loginAttempts = buildLoginAttempts(candidate.partnerId);
  let loginHit: PartnerDiscoveryHit | null = null;

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

      loginHit = {
        partnerId: candidate.partnerId,
        confidence: "verified",
        source: candidate.source,
        apiHost: attempt.apiHost,
        loginPath: attempt.loginPath,
        apiVersion: attempt.apiVersion,
        lineupId,
        channelCount,
        applicationName,
        sampleUrl: lineupId
          ? `kaltura-ott:${candidate.partnerId}:lineup:${lineupId}`
          : `kaltura-ott:${candidate.partnerId}:channels`,
      };
      break;
    } catch {
      /* try next login variant */
    }
  }

  if (!loginHit) {
    if (candidate.weight >= 4) {
      return {
        partnerId: candidate.partnerId,
        confidence: "likely",
        source: candidate.source,
        applicationName,
        sampleUrl: `kaltura-ott:${candidate.partnerId}:channels`,
      };
    }
    return null;
  }

  // Reshet-style: confirm the Android package belongs to this partner via serveByDevice.
  const deviceOk = await probeServeByDevice(request, candidate.partnerId, applicationName);
  if (deviceOk) {
    loginHit.source = `${loginHit.source}; serveByDevice matched ${applicationName}`;
  } else if (candidate.weight < 8) {
    // Anonymous login works for many partners; without an app-specific device match,
    // keep verified only for strong app-FQDN / preset hints.
    loginHit.confidence = "likely";
    loginHit.source = `${loginHit.source}; anonymousLogin ok (serveByDevice did not confirm app)`;
  }

  return loginHit;
}

async function probeServeByDevice(
  request: RequestClient,
  partnerId: number,
  applicationName: string,
): Promise<boolean> {
  const hosts = [
    `https://${partnerId}.frp1.ott.kaltura.com`,
    "https://api.frp1.ott.kaltura.com",
  ];
  const platforms = ["Android", "STB"] as const;
  const apiVersions = ["8.5.0.30179", "5.4.0.28193", "8.5.0"] as const;

  for (const apiHost of hosts) {
    for (const platform of platforms) {
      for (const apiVersion of apiVersions) {
        try {
          const data = await request.json<{
            result?: unknown;
            objectType?: string;
            executionTime?: number;
          }>(`${apiHost}/api_v3/service/configurations/action/serveByDevice`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              "User-Agent": "okhttp/5.0.0-alpha.6",
            },
            body: JSON.stringify({
              apiVersion,
              applicationName,
              clientVersion: "1.0.0",
              partnerId,
              platform,
              tag: "default",
              udid: "405373f4b02c0b23",
            }),
          });
          if (data && typeof data === "object") {
            const asRecord = data as Record<string, unknown>;
            if (asRecord.objectType === "KalturaAPIException") continue;
            if (asRecord.result != null || asRecord.executionTime != null || Object.keys(asRecord).length > 0) {
              return true;
            }
          }
        } catch {
          /* try next variant */
        }
      }
    }
  }
  return false;
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

/** Exported for unit tests — normalize Android package FQDNs. */
export function scrapePartnerCandidates(_text: string): number[] {
  // Kept for backward-compat with older tests; website scrape path removed.
  return [];
}
