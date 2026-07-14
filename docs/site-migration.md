# Site migration tracker

VLC-oriented single-video ports from [yt-dlp](https://github.com/yt-dlp/yt-dlp).  
Machine-readable status: [`site-migration.json`](./site-migration.json).

| Field | Value |
|-------|--------|
| Upstream pin | 2026.07.04 |
| Depth | `vlc-video` (watch/share URL → playable streams; skip playlists/search) |
| Batch size | 10 modules |

## Done criteria (module → `ready`)

- Registered `InfoExtractor` with stable `IE_NAME` (= module id)
- `_VALID_URL` covers main share/embed URLs
- Returns ≥1 progressive or HLS URL for a fixture
- Smoke coverage under `test/extractors/`
- Tracker JSON + this checklist updated
- `urlUsage` + `examples` entry in [`src/extractor/url-usage.ts`](../src/extractor/url-usage.ts) (shown in the extract UI / meta)

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

Status: pending

- [ ] `archiveorg` · `bbc` · `ard` · `arte` · `pbs` · `cnn` · `nbc` · `abc` · `bloomberg` · `reuters`

## Batch 6 — Hosts / short clips

Status: pending

- [ ] `googledrive` · `dropbox` · `imgur` · `redgifs` · `streamable` · `box` · `yandexdisk` · `mediafire` · `pixeldrain` · `streamja`

## Later

Continue in groups of 10. Port `generic` / `genericembeds` last. Mark DRM-only SVOD as `skipped` / `blocked`.

## Workflow

1. Port `src/extractor/<module>/`
2. Register in `src/extractor/register.ts`
3. Add/update `URL_USAGE` guide (what link to paste + examples) in `src/extractor/url-usage.ts`
4. Add/adjust tests; smoke extract once
5. Set module `status` in JSON; tick checkbox here
6. When all 10 in a batch are `ready`, set batch `status` to `complete`

## Tests

```bash
pnpm test                 # URL matching + service force-dispatch
pnpm run test:live        # network extract (jwplatform, bitmovin, CF Stream, dailymotion, soundcloud)
```
