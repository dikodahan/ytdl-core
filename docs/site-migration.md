# Site migration tracker

VLC-oriented single-video ports from [yt-dlp](https://github.com/yt-dlp/yt-dlp).
Machine-readable status: [`site-migration.json`](./site-migration.json).

| Field | Value |
|-------|--------|
| Upstream pin | 2026.07.04 |
| Depth | `vlc-video` (watch/share URL → playable streams; skip playlists/search) |
| Hand-ported | YouTube + batches 0–6 (71 dedicated extractors) |
| Generated | 851 modules via webpage scrape (`src/extractor/generated/`) |
| Generic | catch-all `generic` registered last |

## Done criteria

- **ready** — dedicated TypeScript extractor with fixtures
- **partial** — auto-generated matcher + OG/JSON-LD/HTML5 scrape (best-effort; not full yt-dlp parity)

## YouTube (pre-migration)

- [x] `youtube` — ready

## Batch 0 — Embed platforms

Status: **complete**

- [x] `brightcove`
- [x] `jwplatform`
- [x] `wistia`
- [x] `kaltura`
- [x] `anvato`
- [x] `theplatform`
- [x] `cloudflarestream`
- [x] `bunnycdn`
- [x] `bitmovin`
- [x] `voxmedia`

## Batch 1 — Global platforms

Status: **complete**

- [x] `vimeo`
- [x] `twitch`
- [x] `tiktok`
- [x] `twitter`
- [x] `instagram`
- [x] `facebook`
- [x] `reddit`
- [x] `soundcloud`
- [x] `dailymotion`
- [x] `bilibili`

## Batch 2 — Social / UGC / alt video

Status: **complete**

- [x] `bandcamp`
- [x] `rumble`
- [x] `kick`
- [x] `patreon`
- [x] `bluesky`
- [x] `bitchute`
- [x] `newgrounds`
- [x] `ninegag`
- [x] `coub`
- [x] `peertube`

## Batch 3 — Regional APIs

Status: **complete**

- [x] `niconico`
- [x] `afreecatv`
- [x] `naver`
- [x] `iqiyi`
- [x] `youku`
- [x] `fc2`
- [x] `weibo`
- [x] `xiaohongshu`
- [x] `vk`
- [x] `odnoklassniki`

## Batch 4 — Audio / podcasts

Status: **complete**

- [x] `audiomack`
- [x] `applepodcasts`
- [x] `mixcloud`
- [x] `soundgasm`
- [x] `acast`
- [x] `art19`
- [x] `yandexmusic`
- [x] `audius`
- [x] `bandlab`
- [x] `reverbnation`

## Batch 5 — News / public broadcasters

Status: **complete**

- [x] `archiveorg`
- [x] `bbc`
- [x] `ard`
- [x] `arte`
- [x] `pbs`
- [x] `cnn`
- [x] `nbc`
- [x] `abc`
- [x] `bloomberg`
- [x] `reuters`

## Batch 6 — Hosts / short clips

Status: **complete**

- [x] `googledrive`
- [x] `dropbox`
- [x] `imgur`
- [x] `redgifs`
- [x] `streamable`
- [x] `box`
- [x] `yandexdisk`
- [x] `mediafire`
- [x] `pixeldrain`
- [x] `streamja`

## Batches 7+ — Generated (webpage scrape)

Status: **complete** (851 modules, status `partial`)

Regenerate with:

```bash
pnpm run generate:extractors
```

Catalog: `src/extractor/generated/catalog.json`.

## Generic

- [x] `generic` — ready (fallback scrape for unmatched URLs)

## Tests

```bash
pnpm test                 # URL matching + service force-dispatch
pnpm run test:live        # network extract smoke
```
