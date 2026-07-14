# Syncing YouTube behavior from yt-dlp

This project tracks [`yt-dlp`](https://github.com/yt-dlp/yt-dlp)’s YouTube extractor for correctness.

Local reference checkout used during development: `~/github-repos/yt-dlp`.

## What to sync

| Area | Upstream path | Local path |
|------|---------------|------------|
| Innertube clients / versions | `yt_dlp/extractor/youtube/_base.py` (`INNERTUBE_CLIENTS`) | `src/extractor/youtube/clients.ts` |
| Default client sets | `yt_dlp/extractor/youtube/_video.py` (`_DEFAULT_*_CLIENTS`) | `src/extractor/youtube/clients.ts` + `video.ts` |
| Player / format extraction | `yt_dlp/extractor/youtube/_video.py` | `src/extractor/youtube/video.ts` |
| EJS n/sig solver scripts | `yt-dlp/ejs` releases + `jsc/_builtin/vendor/_info.py` | `src/extractor/youtube/jsc/vendor/` |
| PO token policies | `_base.py` `WEB_PO_TOKEN_POLICIES` / per-client policies | `clients.ts` + `pot/` |

## Current pin

- **yt-dlp reference:** 2026.07.04
- **EJS scripts:** 0.8.0 (`yt.solver.lib.min.js`, `yt.solver.core.min.js` / `yt.solver.core.js`)
- **Default clients (VLC-oriented):** `mweb`, `android` (progressive muxed; `android_vr` skips many kids videos)

## How to refresh

1. Update the local yt-dlp checkout (`git pull` in `~/github-repos/yt-dlp`).
2. Diff `INNERTUBE_CLIENTS` and `_DEFAULT_*_CLIENTS` into `src/extractor/youtube/clients.ts`.
3. Check `jsc/_builtin/vendor/_info.py` for a new EJS `VERSION`.
4. Download matching release assets from `https://github.com/yt-dlp/ejs/releases` into `src/extractor/youtube/jsc/vendor/`.
5. Run `pnpm run build && pnpm run test:extract`.

## PO tokens

Many HTTPS/DASH formats require a Google Video (GVS) PO token. Pass manual tokens via:

```js
ytdl.getInfo(url, {
  poTokens: ["web.gvs+BASE64URL_TOKEN", "android.player+BASE64URL_TOKEN"],
});
```

Or with the core API:

```js
const { extractInfo } = require("@distube/ytdl-core/core");
await extractInfo(url, { poTokens: ["android_vr.gvs+TOKEN"] });
```

Without tokens, prefer JS-less clients such as `android_vr` which often still return direct URLs.
