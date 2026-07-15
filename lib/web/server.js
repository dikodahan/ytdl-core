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
exports.createWebServer = createWebServer;
exports.startWebServer = startWebServer;
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const tokens_1 = require("./tokens");
const extract_1 = require("./extract");
const list_1 = require("./list");
const MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
};
function publicDir() {
    const candidates = [
        path.join(__dirname, "..", "..", "web", "public"),
        path.join(process.cwd(), "web", "public"),
    ];
    for (const dir of candidates) {
        if (fs.existsSync(dir))
            return dir;
    }
    return candidates[0];
}
async function readBody(req) {
    const chunks = [];
    for await (const chunk of req)
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks).toString("utf8");
}
function sendJson(res, status, data) {
    const body = JSON.stringify(data, null, 2);
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, X-API-Token",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    });
    res.end(body);
}
function serveStatic(res, filePath) {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404).end("Not found");
        return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
}
function unauthorized(res, message = "Unauthorized") {
    sendJson(res, 401, {
        error: message,
        hint: "Pass Authorization: Bearer <token> (create one in Settings).",
    });
}
function createWebServer(options = {}) {
    const root = publicDir();
    const tokens = (0, tokens_1.getTokenStore)();
    const requireAuth = options.requireAuth ??
        (process.env.YTDL_API_REQUIRE_AUTH === "1" || process.env.YTDL_API_REQUIRE_AUTH === "true");
    return http.createServer(async (req, res) => {
        try {
            if (req.method === "OPTIONS") {
                res.writeHead(204, {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-API-Token",
                    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
                });
                res.end();
                return;
            }
            const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
            const { pathname } = url;
            const loopback = (0, extract_1.isLoopback)(req);
            const bearer = (0, extract_1.extractBearerToken)(req);
            const authToken = tokens.authenticate(bearer);
            const allowLab = !requireAuth && loopback;
            const allowTokenAdmin = loopback || !!authToken;
            // --- public ---
            if (req.method === "GET" && (pathname === "/api/health" || pathname === "/api/v1/health")) {
                sendJson(res, 200, {
                    ok: true,
                    api: "v1",
                    authRequired: true,
                    tokensFile: tokens.filePath,
                });
                return;
            }
            // --- token admin (loopback UI or any valid bearer) ---
            if (pathname === "/api/v1/tokens" || pathname === "/api/settings/tokens") {
                if (!allowTokenAdmin) {
                    unauthorized(res, "Token management requires localhost or a valid API token");
                    return;
                }
                if (req.method === "GET") {
                    sendJson(res, 200, { ok: true, tokens: tokens.list(), store: tokens.filePath });
                    return;
                }
                if (req.method === "POST") {
                    const raw = await readBody(req);
                    const body = JSON.parse(raw || "{}");
                    const created = tokens.create(body.name || "API token");
                    sendJson(res, 201, {
                        ok: true,
                        token: created,
                        warning: "Copy this token now — it will not be shown again.",
                    });
                    return;
                }
            }
            const revokeMatch = pathname.match(/^\/api\/v1\/tokens\/([^/]+)\/revoke$/);
            if (revokeMatch && req.method === "POST") {
                if (!allowTokenAdmin) {
                    unauthorized(res, "Token management requires localhost or a valid API token");
                    return;
                }
                const record = tokens.revoke(revokeMatch[1]);
                if (!record) {
                    sendJson(res, 404, { error: "Token not found" });
                    return;
                }
                sendJson(res, 200, { ok: true, token: record });
                return;
            }
            const deleteMatch = pathname.match(/^\/api\/v1\/tokens\/([^/]+)$/);
            if (deleteMatch && req.method === "DELETE") {
                if (!allowTokenAdmin) {
                    unauthorized(res, "Token management requires localhost or a valid API token");
                    return;
                }
                const ok = tokens.delete(deleteMatch[1]);
                if (!ok) {
                    sendJson(res, 404, { error: "Token not found" });
                    return;
                }
                sendJson(res, 200, { ok: true });
                return;
            }
            // --- versioned API (Bearer required) ---
            if (pathname === "/api/v1/meta" && req.method === "GET") {
                if (!authToken) {
                    unauthorized(res);
                    return;
                }
                sendJson(res, 200, { ok: true, ...(0, extract_1.metaPayload)(), auth: { tokenId: authToken.id, name: authToken.name } });
                return;
            }
            if (pathname === "/api/v1/extract" && req.method === "POST") {
                if (!authToken) {
                    unauthorized(res);
                    return;
                }
                const raw = await readBody(req);
                const parsed = (0, extract_1.parseExtractBody)(raw);
                const result = await (0, extract_1.runExtract)(parsed);
                sendJson(res, result.status, result.body);
                return;
            }
            if (pathname === "/api/v1/list" && req.method === "POST") {
                if (!authToken) {
                    unauthorized(res);
                    return;
                }
                const raw = await readBody(req);
                const parsed = (0, list_1.parseListBody)(raw);
                const result = await (0, list_1.runList)(parsed);
                sendJson(res, result.status, result.body);
                return;
            }
            // --- lab UI helpers (loopback by default) ---
            if (pathname === "/api/meta" && req.method === "GET") {
                if (!allowLab && !authToken) {
                    unauthorized(res);
                    return;
                }
                sendJson(res, 200, (0, extract_1.metaPayload)());
                return;
            }
            if (pathname === "/api/extract" && req.method === "POST") {
                if (!allowLab && !authToken) {
                    unauthorized(res);
                    return;
                }
                const raw = await readBody(req);
                const parsed = (0, extract_1.parseExtractBody)(raw);
                const result = await (0, extract_1.runExtract)(parsed);
                sendJson(res, result.status, result.body);
                return;
            }
            if (pathname === "/api/list" && req.method === "POST") {
                if (!allowLab && !authToken) {
                    unauthorized(res);
                    return;
                }
                const raw = await readBody(req);
                const parsed = (0, list_1.parseListBody)(raw);
                const result = await (0, list_1.runList)(parsed);
                sendJson(res, result.status, result.body);
                return;
            }
            // Static files
            let rel = pathname === "/" ? "/index.html" : pathname;
            rel = path.normalize(rel).replace(/^(\.\.[/\\])+/, "");
            const filePath = path.join(root, rel);
            if (!filePath.startsWith(root)) {
                res.writeHead(403).end("Forbidden");
                return;
            }
            serveStatic(res, filePath);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            sendJson(res, 500, { error: message });
        }
    });
}
function startWebServer(options = {}) {
    const host = options.host || process.env.YTDL_WEB_HOST || "127.0.0.1";
    const port = options.port || Number(process.env.YTDL_WEB_PORT || 8787);
    const server = createWebServer(options);
    server.listen(port, host, () => {
        console.log(`ytdl-core web UI → http://${host}:${port}`);
        console.log(`API v1            → http://${host}:${port}/api/v1`);
        console.log(`Settings          → http://${host}:${port}/settings.html`);
        console.log(`Tokens store      → ${(0, tokens_1.getTokenStore)().filePath}`);
    });
    return server;
}
if (require.main === module) {
    startWebServer();
}
//# sourceMappingURL=server.js.map