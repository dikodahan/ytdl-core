# @distube/ytdl-core

YouTube video info / download library with a **yt-dlp-inspired TypeScript core**, **Cloudflare/TLS impersonation**, a **local web UI**, and a **ytdl-core compatibility layer**.

## Install

```bash
pnpm add @distube/ytdl-core@latest
```

Requires **Node.js ≥ 22.19** and **pnpm** (this repo is pnpm-only).

For full Cloudflare TLS/JA3 bypass, also install the optional CycleTLS dependency:

```bash
pnpm add cycletls
```

## Quick start (compat API)

```js
const ytdl = require("@distube/ytdl-core");

ytdl("https://www.youtube.com/watch?v=aqz-KE-bpKQ").pipe(require("fs").createWriteStream("video.mp4"));

const info = await ytdl.getInfo("aqz-KE-bpKQ");
console.log(info.videoDetails.title, info.formats.length);
```

### Cookies / proxy

```js
const agent = ytdl.createAgent([{ name: "LOGIN_INFO", value: "..." }]);
await ytdl.getInfo(url, { agent });
```

### PO tokens

Many formats need a Proof-of-Origin (PO) token (same issue yt-dlp hits). Supply manual tokens:

```js
await ytdl.getInfo(url, {
  poTokens: ["web.gvs+TOKEN", "web.player+TOKEN"],
  playerClients: ["WEB", "ANDROID"],
});
```

See [docs/yt-dlp-sync.md](docs/yt-dlp-sync.md).

## New core API

```js
const { YoutubeDL, extractInfo } = require("@distube/ytdl-core/core");

const info = await extractInfo("aqz-KE-bpKQ", {
  vlcOnly: true, // progressive muxed / HLS for local VLC (default)
  cloudflareBypass: true,
});
// Prefer info.formats[0] (sorted for VLC) — open the URL in VLC: Media → Open Network Stream

const ydl = new YoutubeDL({ format: "best" });
ydl.download(url).pipe(fs.createWriteStream("out.mp4"));
```

## Cloudflare / TLS impersonation

Bot management often scores Undici/OpenSSL JA3 fingerprints. With optional **CycleTLS**:

| Param                        | Effect                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `impersonate: "chrome" \| …` | Browser-like headers (profile for CF retries)                                 |
| `cloudflareBypass: true`     | If Undici hits a CF challenge page, retry that request via CycleTLS           |
| `forceImpersonate: true`     | Send **all** traffic through CycleTLS (stronger; can break YouTube Innertube) |

Default extraction keeps Undici (best for YouTube). Enable `cloudflareBypass` for challenge retries. Without `cycletls`, only header spoofing applies. JS/Turnstile still needs cookies or a real browser.

## Web UI & HTTP API

```bash
pnpm run build
pnpm run web
# UI:       http://127.0.0.1:8787
# Settings: http://127.0.0.1:8787/settings.html
# API:      http://127.0.0.1:8787/api/v1
```

### API tokens

Open **Settings** to generate a Bearer token. The full secret is shown once; only a SHA-256 hash is stored under `~/.ytdl-core/api-tokens.json` (override with `YTDL_DATA_DIR`).

```bash
# Extract (requires token); optional service/site forces the extractor
curl -s http://127.0.0.1:8787/api/v1/extract \
  -H "Authorization: Bearer ytdl_…" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.dailymotion.com/video/x5kesuj","service":"dailymotion"}'

curl -s http://127.0.0.1:8787/api/v1/meta \
  -H "Authorization: Bearer ytdl_…"
```

Force a service from the core API:

```js
const { extractInfo } = require("@distube/ytdl-core/core");
await extractInfo(url, { service: "vimeo" }); // alias: site
```

Multi-site progress: [docs/site-migration.md](docs/site-migration.md).

`GET /api/v1/meta` (and the extract UI site picker) include per-provider **`urlUsage`**, **`examples`**, and optional **`notes`** — what link to paste for each service.

| Endpoint                         | Auth                    |
| -------------------------------- | ----------------------- |
| `GET /api/v1/health`             | none                    |
| `GET /api/v1/meta`               | Bearer                  |
| `POST /api/v1/extract`           | Bearer                  |
| `POST /api/v1/list`              | Bearer                  |
| `GET/POST /api/v1/tokens`        | localhost **or** Bearer |
| `POST /api/v1/tokens/:id/revoke` | localhost **or** Bearer |
| `DELETE /api/v1/tokens/:id`      | localhost **or** Bearer |

Lab helpers `/api/meta` and `/api/extract` stay open for the local UI on loopback. Set `YTDL_API_REQUIRE_AUTH=1` to require Bearer everywhere.

Env: `YTDL_WEB_HOST`, `YTDL_WEB_PORT`, `YTDL_DATA_DIR`, `YTDL_API_REQUIRE_AUTH`.

## Architecture

```
URL → YoutubeDL → Extractor registry (service/site or auto)
                 → site IE (YouTube, Vimeo, Dailymotion, …)
     → format select → HTTP / HLS downloader
```

YouTube client versions and EJS scripts are synced from [yt-dlp](https://github.com/yt-dlp/yt-dlp). Batches 0–6 are hand-ported (~71 dedicated extractors); remaining yt-dlp modules are registered as best-effort webpage scrapers plus a `generic` fallback — see the migration tracker.

## Scripts

```bash
pnpm install
pnpm run build         # compile TypeScript → lib/ + copy EJS vendor scripts
pnpm run typecheck
pnpm test              # extractor URL / service dispatch tests
pnpm run test:live     # optional live network extract smoke
pnpm run test:extract  # YouTube network smoke
pnpm run web           # extraction lab UI + API
```

## Legacy note

This package previously lived as a DisTube-maintained fork of `fent/node-ytdl-core` and was marked unmaintained in favor of youtubei.js. The **5.x** line rebuilds the internals around yt-dlp’s YouTube strategy while keeping the classic `ytdl` / `getInfo` surface via `lib/compat`.

## License

MIT
