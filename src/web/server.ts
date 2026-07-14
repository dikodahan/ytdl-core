import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { getTokenStore } from "./tokens";
import {
  extractBearerToken,
  isLoopback,
  metaPayload,
  parseExtractBody,
  runExtract,
} from "./extract";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function publicDir(): string {
  const candidates = [
    path.join(__dirname, "..", "..", "web", "public"),
    path.join(process.cwd(), "web", "public"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0];
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(res: http.ServerResponse, status: number, data: unknown): void {
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

function serveStatic(res: http.ServerResponse, filePath: string): void {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404).end("Not found");
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

function unauthorized(res: http.ServerResponse, message = "Unauthorized"): void {
  sendJson(res, 401, {
    error: message,
    hint: "Pass Authorization: Bearer <token> (create one in Settings).",
  });
}

export interface WebServerOptions {
  host?: string;
  port?: number;
  /** When true, lab /api/extract and /api/meta also require a Bearer token (even on loopback). */
  requireAuth?: boolean;
}

export function createWebServer(options: WebServerOptions = {}): http.Server {
  const root = publicDir();
  const tokens = getTokenStore();
  const requireAuth =
    options.requireAuth ??
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
      const loopback = isLoopback(req);
      const bearer = extractBearerToken(req);
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
          const body = JSON.parse(raw || "{}") as { name?: string };
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
        sendJson(res, 200, { ok: true, ...metaPayload(), auth: { tokenId: authToken.id, name: authToken.name } });
        return;
      }

      if (pathname === "/api/v1/extract" && req.method === "POST") {
        if (!authToken) {
          unauthorized(res);
          return;
        }
        const raw = await readBody(req);
        const parsed = parseExtractBody(raw);
        const result = await runExtract(parsed);
        sendJson(res, result.status, result.body);
        return;
      }

      // --- lab UI helpers (loopback by default) ---
      if (pathname === "/api/meta" && req.method === "GET") {
        if (!allowLab && !authToken) {
          unauthorized(res);
          return;
        }
        sendJson(res, 200, metaPayload());
        return;
      }

      if (pathname === "/api/extract" && req.method === "POST") {
        if (!allowLab && !authToken) {
          unauthorized(res);
          return;
        }
        const raw = await readBody(req);
        const parsed = parseExtractBody(raw);
        const result = await runExtract(parsed);
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: message });
    }
  });
}

export function startWebServer(options: WebServerOptions = {}): http.Server {
  const host = options.host || process.env.YTDL_WEB_HOST || "127.0.0.1";
  const port = options.port || Number(process.env.YTDL_WEB_PORT || 8787);
  const server = createWebServer(options);
  server.listen(port, host, () => {
    console.log(`ytdl-core web UI → http://${host}:${port}`);
    console.log(`API v1            → http://${host}:${port}/api/v1`);
    console.log(`Settings          → http://${host}:${port}/settings.html`);
    console.log(`Tokens store      → ${getTokenStore().filePath}`);
  });
  return server;
}

if (require.main === module) {
  startWebServer();
}
