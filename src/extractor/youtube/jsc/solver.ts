import { Worker } from "worker_threads";
import * as fs from "fs";
import * as path from "path";
import type { RequestClient } from "../../../networking/request";

export type ChallengeType = "n" | "sig";

export interface ChallengeRequest {
  type: ChallengeType;
  challenges: string[];
  playerUrl: string;
  videoId?: string;
}

export interface ChallengeResponse {
  type: ChallengeType;
  /** Map of challenge input → solved output (EJS / yt-dlp shape) */
  results: Record<string, string>;
}

const EJS_VERSION = "0.8.0";
const VENDOR_DIR = path.join(__dirname, "vendor");
const WORKER_PATH = path.join(__dirname, "ejs-worker.js");

function loadVendor(name: string): string {
  const candidates = [
    path.join(VENDOR_DIR, name),
    path.join(VENDOR_DIR, name.replace(".js", ".min.js")),
    path.join(__dirname, "..", "..", "..", "..", "src", "extractor", "youtube", "jsc", "vendor", name),
    path.join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "src",
      "extractor",
      "youtube",
      "jsc",
      "vendor",
      name.replace(".js", ".min.js"),
    ),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  }
  throw new Error(
    `EJS solver script not found: ${name}. Expected under src/extractor/youtube/jsc/vendor (v${EJS_VERSION})`,
  );
}

let cachedLib: string | null = null;
let cachedCore: string | null = null;

function getLib(): string {
  cachedLib ??= loadVendor("yt.solver.lib.min.js");
  return cachedLib;
}

function getCore(): string {
  try {
    cachedCore ??= loadVendor("yt.solver.core.min.js");
  } catch {
    cachedCore = loadVendor("yt.solver.core.js");
  }
  return cachedCore;
}

function normalizeResultMap(data: unknown): Record<string, string> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function runInWorker(payload: {
  lib: string;
  core: string;
  player: string;
  requests: Array<{ type: string; challenges: string[] }>;
}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const worker = new Worker(WORKER_PATH, {
      workerData: payload,
    });
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(() => {
      void worker.terminate();
      done(() => reject(new Error("EJS worker timed out")));
    }, 60_000);

    worker.once("message", msg => {
      void worker.terminate();
      done(() => {
        if (msg && typeof msg === "object" && "error" in msg && msg.error) {
          reject(new Error(String(msg.error)));
        } else {
          resolve((msg as { result?: unknown })?.result);
        }
      });
    });
    worker.once("error", err => {
      done(() => reject(err));
    });
    worker.once("exit", code => {
      // Only surface exit errors if we never got a message
      done(() => {
        if (code !== 0) reject(new Error(`EJS worker exited with code ${code}`));
      });
    });
  });
}

export class NodeEjsChallengeSolver {
  private readonly playerCache = new Map<string, string>();
  private readonly request: RequestClient;

  constructor(request: RequestClient) {
    this.request = request;
  }

  async solve(requests: ChallengeRequest[]): Promise<ChallengeResponse[]> {
    if (!requests.length) return [];

    const byPlayer = new Map<string, ChallengeRequest[]>();
    for (const req of requests) {
      const list = byPlayer.get(req.playerUrl) || [];
      list.push(req);
      byPlayer.set(req.playerUrl, list);
    }

    const out: ChallengeResponse[] = [];
    for (const [playerUrl, group] of byPlayer) {
      const player = await this.getPlayer(playerUrl);
      const solved = await this.runSolver(player, group);
      out.push(...solved);
    }
    return out;
  }

  private async getPlayer(playerUrl: string): Promise<string> {
    const cached = this.playerCache.get(playerUrl);
    if (cached) return cached;
    const body = await this.request.text(playerUrl);
    this.playerCache.set(playerUrl, body);
    return body;
  }

  private async runSolver(player: string, requests: ChallengeRequest[]): Promise<ChallengeResponse[]> {
    const deduped = requests.map(r => ({
      ...r,
      challenges: [...new Set(r.challenges.filter(Boolean))],
    }));

    const output = (await runInWorker({
      lib: getLib(),
      core: getCore(),
      player,
      requests: deduped.map(r => ({ type: r.type, challenges: r.challenges })),
    })) as {
      type: string;
      error?: string;
      responses?: Array<{ type: string; data?: unknown; error?: string }>;
    };

    if (!output || output.type === "error") {
      throw new Error(`EJS solver error: ${output?.error || "unknown"}`);
    }

    return deduped.map((req, i) => {
      const resp = output.responses?.[i];
      if (!resp || resp.type === "error") {
        throw new Error(`EJS challenge failed (${req.type}): ${resp?.error || "unknown"}`);
      }
      return { type: req.type, results: normalizeResultMap(resp.data) };
    });
  }
}

export const EJS_SCRIPT_VERSION = EJS_VERSION;
