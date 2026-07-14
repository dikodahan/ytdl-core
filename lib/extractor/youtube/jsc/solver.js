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
exports.EJS_SCRIPT_VERSION = exports.NodeEjsChallengeSolver = void 0;
const worker_threads_1 = require("worker_threads");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const EJS_VERSION = "0.8.0";
const VENDOR_DIR = path.join(__dirname, "vendor");
const WORKER_PATH = path.join(__dirname, "ejs-worker.js");
function loadVendor(name) {
    const candidates = [
        path.join(VENDOR_DIR, name),
        path.join(VENDOR_DIR, name.replace(".js", ".min.js")),
        path.join(__dirname, "..", "..", "..", "..", "src", "extractor", "youtube", "jsc", "vendor", name),
        path.join(__dirname, "..", "..", "..", "..", "src", "extractor", "youtube", "jsc", "vendor", name.replace(".js", ".min.js")),
    ];
    for (const p of candidates) {
        if (fs.existsSync(p))
            return fs.readFileSync(p, "utf8");
    }
    throw new Error(`EJS solver script not found: ${name}. Expected under src/extractor/youtube/jsc/vendor (v${EJS_VERSION})`);
}
let cachedLib = null;
let cachedCore = null;
function getLib() {
    cachedLib ??= loadVendor("yt.solver.lib.min.js");
    return cachedLib;
}
function getCore() {
    try {
        cachedCore ??= loadVendor("yt.solver.core.min.js");
    }
    catch {
        cachedCore = loadVendor("yt.solver.core.js");
    }
    return cachedCore;
}
function normalizeResultMap(data) {
    if (!data || typeof data !== "object" || Array.isArray(data))
        return {};
    const out = {};
    for (const [k, v] of Object.entries(data)) {
        if (typeof v === "string")
            out[k] = v;
    }
    return out;
}
function runInWorker(payload) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const worker = new worker_threads_1.Worker(WORKER_PATH, {
            workerData: payload,
        });
        const done = (fn) => {
            if (settled)
                return;
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
                }
                else {
                    resolve(msg?.result);
                }
            });
        });
        worker.once("error", err => {
            done(() => reject(err));
        });
        worker.once("exit", code => {
            // Only surface exit errors if we never got a message
            done(() => {
                if (code !== 0)
                    reject(new Error(`EJS worker exited with code ${code}`));
            });
        });
    });
}
class NodeEjsChallengeSolver {
    playerCache = new Map();
    request;
    constructor(request) {
        this.request = request;
    }
    async solve(requests) {
        if (!requests.length)
            return [];
        const byPlayer = new Map();
        for (const req of requests) {
            const list = byPlayer.get(req.playerUrl) || [];
            list.push(req);
            byPlayer.set(req.playerUrl, list);
        }
        const out = [];
        for (const [playerUrl, group] of byPlayer) {
            const player = await this.getPlayer(playerUrl);
            const solved = await this.runSolver(player, group);
            out.push(...solved);
        }
        return out;
    }
    async getPlayer(playerUrl) {
        const cached = this.playerCache.get(playerUrl);
        if (cached)
            return cached;
        const body = await this.request.text(playerUrl);
        this.playerCache.set(playerUrl, body);
        return body;
    }
    async runSolver(player, requests) {
        const deduped = requests.map(r => ({
            ...r,
            challenges: [...new Set(r.challenges.filter(Boolean))],
        }));
        const output = (await runInWorker({
            lib: getLib(),
            core: getCore(),
            player,
            requests: deduped.map(r => ({ type: r.type, challenges: r.challenges })),
        }));
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
exports.NodeEjsChallengeSolver = NodeEjsChallengeSolver;
exports.EJS_SCRIPT_VERSION = EJS_VERSION;
//# sourceMappingURL=solver.js.map