"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadMigrationTracker = loadMigrationTracker;
exports.migrationStatusBySite = migrationStatusBySite;
exports.listPlannedModules = listPlannedModules;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function trackerPath() {
    const candidates = [
        path.join(__dirname, "..", "..", "docs", "site-migration.json"),
        path.join(process.cwd(), "docs", "site-migration.json"),
    ];
    for (const p of candidates) {
        if (fs.existsSync(p))
            return p;
    }
    return candidates[0];
}
let cached = null;
function loadMigrationTracker(force = false) {
    if (cached && !force)
        return cached;
    const file = trackerPath();
    try {
        cached = JSON.parse(fs.readFileSync(file, "utf8"));
    }
    catch {
        cached = { upstreamPin: "unknown", depth: "vlc-video", batches: [] };
    }
    return cached;
}
function migrationStatusBySite() {
    const tracker = loadMigrationTracker();
    const map = new Map();
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
function listPlannedModules() {
    const tracker = loadMigrationTracker();
    const out = [];
    for (const batch of tracker.batches || []) {
        for (const mod of batch.modules || []) {
            out.push({ ...mod, batch: batch.id, batchTitle: batch.title });
        }
    }
    return out;
}
//# sourceMappingURL=tracker.js.map