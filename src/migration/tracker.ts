import * as fs from "fs";
import * as path from "path";
import type { MigrationStatus } from "../core/info-extractor";

export interface MigrationModule {
  id: string;
  status: MigrationStatus;
  ies?: string[];
}

export interface MigrationBatch {
  id: number;
  title: string;
  status: string;
  modules: MigrationModule[];
}

export interface MigrationTracker {
  upstreamPin: string;
  depth: string;
  youtube?: MigrationModule;
  batches: MigrationBatch[];
}

function trackerPath(): string {
  const candidates = [
    path.join(__dirname, "..", "..", "docs", "site-migration.json"),
    path.join(process.cwd(), "docs", "site-migration.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

let cached: MigrationTracker | null = null;

export function loadMigrationTracker(force = false): MigrationTracker {
  if (cached && !force) return cached;
  const file = trackerPath();
  try {
    cached = JSON.parse(fs.readFileSync(file, "utf8")) as MigrationTracker;
  } catch {
    cached = { upstreamPin: "unknown", depth: "vlc-video", batches: [] };
  }
  return cached;
}

export function migrationStatusBySite(): Map<string, { status: MigrationStatus; batch: number | null }> {
  const tracker = loadMigrationTracker();
  const map = new Map<string, { status: MigrationStatus; batch: number | null }>();
  if (tracker.youtube) {
    map.set(tracker.youtube.id, { status: tracker.youtube.status, batch: null });
  }
  for (const batch of tracker.batches || []) {
    for (const mod of batch.modules || []) {
      map.set(mod.id, { status: mod.status, batch: batch.id });
    }
  }
  return map;
}

export function listPlannedModules(): Array<MigrationModule & { batch: number; batchTitle: string }> {
  const tracker = loadMigrationTracker();
  const out: Array<MigrationModule & { batch: number; batchTitle: string }> = [];
  for (const batch of tracker.batches || []) {
    for (const mod of batch.modules || []) {
      out.push({ ...mod, batch: batch.id, batchTitle: batch.title });
    }
  }
  return out;
}
