#!/usr/bin/env python3
"""Generate catalog.json for yt-dlp extractors not yet hand-ported."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
YTDLP = Path.home() / "github-repos" / "yt-dlp" / "yt_dlp" / "extractor"
OUT = ROOT / "src" / "extractor" / "generated" / "catalog.json"

# Already registered as dedicated TypeScript extractors (folder / IE_NAME).
HAND_PORTED = {
    "youtube",
    "brightcove", "jwplatform", "wistia", "kaltura", "anvato", "theplatform",
    "cloudflarestream", "bunnycdn", "bitmovin", "voxmedia",
    "vimeo", "twitch", "tiktok", "twitter", "instagram", "facebook",
    "reddit", "soundcloud", "dailymotion", "bilibili",
    "bandcamp", "rumble", "kick", "patreon", "bluesky", "bitchute",
    "newgrounds", "ninegag", "coub", "peertube",
    "niconico", "afreecatv", "naver", "iqiyi", "youku", "fc2",
    "weibo", "xiaohongshu", "vk", "odnoklassniki",
    "audiomack", "applepodcasts", "mixcloud", "soundgasm", "acast",
    "art19", "yandexmusic", "audius", "bandlab", "reverbnation",
    "archiveorg", "bbc", "ard", "arte", "pbs", "cnn", "nbc", "abc",
    "bloomberg", "reuters",
    "googledrive", "dropbox", "imgur", "redgifs", "streamable", "box",
    "yandexdisk", "mediafire", "pixeldrain", "streamja",
}

INFRA = {
    "common.py", "commonprotocols.py", "commonmistakes.py", "extractors.py",
    "_extractors.py", "__init__.py", "lazy_extractors.py", "adobepass.py",
    "generic.py", "genericembeds.py", "unsupported.py",
}

SKIP_IE_SUFFIX = ("BaseIE", "PlaylistIE", "ChannelIE", "UserIE", "SearchIE", "ShowIE", "TabIE")


def python_regex_to_js(raw: str) -> str | None:
    """Best-effort convert a Python raw regex to a JS RegExp source string."""
    s = raw.strip()
    if not s or s in ("False", "None", ".*"):
        return None
    # Drop verbose / unicode / ascii flags prefixes inside pattern
    s = re.sub(r"^\(\?[aiLmsux]+\)", "", s)
    # Named groups
    s = re.sub(r"\(\?P<(\w+)>", r"(?<\1>", s)
    # Common verbose whitespace: if (?x) was used, python already embeds; leave as-is
    # Unescape python-only
    if "(?P<" in s:  # conversion failed remnant
        return None
    # Extremely long / risky patterns — still ok to ship
    if len(s) > 4000:
        return None
    try:
        re.compile(s)
    except re.error:
        # Still try in JS-land; store anyway if no obvious python-only constructs
        if "(?" in s and not re.search(r"\(\?<", s):
            # Lookaheads are fine in JS; conditional (?( are not
            if "(?(" in s:
                return None
    return s


def extract_string_assignment(text: str, name: str) -> str | None:
    # IE_NAME = 'foo' or _VALID_URL = r'...' / r'''...'''
    patterns = [
        rf"{name}\s*=\s*r?'''([\s\S]*?)'''",
        rf'{name}\s*=\s*r?"""([\s\S]*?)"""',
        rf"{name}\s*=\s*r?'([^']*)'",
        rf'{name}\s*=\s*r?"([^"]*)"',
        rf"{name}\s*=\s*'([^']*)'",
        rf'{name}\s*=\s*"([^"]*)"',
    ]
    for pat in patterns:
        m = re.search(pat, text)
        if m:
            return m.group(1)
    return None


def extract_valid_url(text: str) -> list[str]:
    # Single assignment
    single = extract_string_assignment(text, "_VALID_URL")
    if single and single not in ("False", "None"):
        js = python_regex_to_js(single)
        return [js] if js else []

    # Tuple / list of regexes
    m = re.search(r"_VALID_URL\s*=\s*\(([\s\S]*?)\)\s*\n", text)
    if not m:
        m = re.search(r"_VALID_URL\s*=\s*\[([\s\S]*?)\]\s*\n", text)
    if not m:
        return []
    body = m.group(1)
    parts = re.findall(r"r?'''([\s\S]*?)'''|r?\"\"\"([\s\S]*?)\"\"\"|r?'([^']*)'|r?\"([^\"]*)\"", body)
    out = []
    for a, b, c, d in parts:
        raw = a or b or c or d
        js = python_regex_to_js(raw)
        if js:
            out.append(js)
    return out


def hosts_from_tests(text: str) -> list[str]:
    urls = re.findall(r"'url'\s*:\s*'([^']+)'", text)
    hosts: list[str] = []
    for u in urls[:8]:
        if u.startswith(("http://", "https://")):
            try:
                from urllib.parse import urlparse

                h = urlparse(u).hostname
                if h and h not in hosts:
                    hosts.append(h)
            except Exception:
                pass
    return hosts


def parse_file(path: Path) -> dict | None:
    """Collapse a site module into one catalog entry (merge patterns from video IEs)."""
    module = path.stem.lower()
    if module in HAND_PORTED:
        return None
    text = path.read_text(encoding="utf-8", errors="ignore")
    patterns: list[str] = []
    hosts: list[str] = []
    ie_classes: list[str] = []
    desc = module

    for m in re.finditer(r"^class\s+(\w+IE)\s*\(([^)]*)\):", text, re.M):
        cls = m.group(1)
        if cls.endswith(SKIP_IE_SUFFIX) or "BaseIE" in cls:
            continue
        start = m.start()
        nxt = re.search(r"^class\s+\w+", text[m.end() :], re.M)
        body = text[start : m.end() + (nxt.start() if nxt else len(text))]
        if re.search(r"_ENABLED\s*=\s*False", body):
            continue
        ie_classes.append(cls)
        d = extract_string_assignment(body, "IE_DESC")
        if d and d is not False and desc == module:
            desc = d
        for p in extract_valid_url(body):
            if p and p != ".*" and p not in patterns:
                patterns.append(p)
        for h in hosts_from_tests(body):
            if h not in hosts:
                hosts.append(h)

    # Module-level _VALID_URL if class scan found nothing
    if not patterns:
        for p in extract_valid_url(text):
            if p and p != ".*" and p not in patterns:
                patterns.append(p)
    if not hosts:
        hosts = hosts_from_tests(text)

    if not patterns and not hosts:
        return None

    return {
        "id": module,
        "ieClass": ie_classes[0] if ie_classes else f"{module.title()}IE",
        "ieName": module,
        "description": f"{desc} (auto-generated webpage extract)",
        "patterns": patterns[:12],
        "hosts": hosts[:12],
        "module": module,
        "source": "generated",
    }


HAND_BATCHES = [
    {
        "id": 0,
        "title": "Embed platforms",
        "modules": [
            "brightcove", "jwplatform", "wistia", "kaltura", "anvato",
            "theplatform", "cloudflarestream", "bunnycdn", "bitmovin", "voxmedia",
        ],
    },
    {
        "id": 1,
        "title": "Global platforms",
        "modules": [
            "vimeo", "twitch", "tiktok", "twitter", "instagram",
            "facebook", "reddit", "soundcloud", "dailymotion", "bilibili",
        ],
    },
    {
        "id": 2,
        "title": "Social / UGC / alt video",
        "modules": [
            "bandcamp", "rumble", "kick", "patreon", "bluesky",
            "bitchute", "newgrounds", "ninegag", "coub", "peertube",
        ],
    },
    {
        "id": 3,
        "title": "Regional APIs",
        "modules": [
            "niconico", "afreecatv", "naver", "iqiyi", "youku",
            "fc2", "weibo", "xiaohongshu", "vk", "odnoklassniki",
        ],
    },
    {
        "id": 4,
        "title": "Audio / podcasts",
        "modules": [
            "audiomack", "applepodcasts", "mixcloud", "soundgasm", "acast",
            "art19", "yandexmusic", "audius", "bandlab", "reverbnation",
        ],
    },
    {
        "id": 5,
        "title": "News / public broadcasters",
        "modules": [
            "archiveorg", "bbc", "ard", "arte", "pbs",
            "cnn", "nbc", "abc", "bloomberg", "reuters",
        ],
    },
    {
        "id": 6,
        "title": "Hosts / short clips",
        "modules": [
            "googledrive", "dropbox", "imgur", "redgifs", "streamable",
            "box", "yandexdisk", "mediafire", "pixeldrain", "streamja",
        ],
    },
]


def write_migration_tracker(catalog: list[dict]) -> None:
    docs = ROOT / "docs"
    batches = []
    for hb in HAND_BATCHES:
        batches.append(
            {
                "id": hb["id"],
                "title": hb["title"],
                "status": "complete",
                "modules": [
                    {"id": mid, "status": "ready", "ies": [f"{mid}IE"]} for mid in hb["modules"]
                ],
            }
        )

    # Remaining modules in batches of 10 — all auto-generated (partial webpage scrape)
    chunk_size = 10
    next_id = 7
    for i in range(0, len(catalog), chunk_size):
        chunk = catalog[i : i + chunk_size]
        batches.append(
            {
                "id": next_id,
                "title": f"Generated webpage scrape ({chunk[0]['id']}–{chunk[-1]['id']})",
                "status": "complete",
                "source": "generated",
                "modules": [
                    {
                        "id": e["id"],
                        "status": "partial",
                        "ies": [e.get("ieClass") or f"{e['id']}IE"],
                        "source": "generated",
                    }
                    for e in chunk
                ],
            }
        )
        next_id += 1

    # generic fallback
    batches.append(
        {
            "id": next_id,
            "title": "Generic fallback",
            "status": "complete",
            "modules": [
                {"id": "generic", "status": "ready", "ies": ["GenericIE"], "source": "hand"},
            ],
        }
    )

    tracker = {
        "upstreamPin": "2026.07.04",
        "depth": "vlc-video",
        "youtube": {"id": "youtube", "status": "ready", "ies": ["YoutubeIE"]},
        "handPortedCount": 1 + sum(len(b["modules"]) for b in HAND_BATCHES),
        "generatedCount": len(catalog),
        "batches": batches,
    }
    (docs / "site-migration.json").write_text(json.dumps(tracker, indent=2) + "\n")

    lines = [
        "# Site migration tracker",
        "",
        "VLC-oriented single-video ports from [yt-dlp](https://github.com/yt-dlp/yt-dlp).",
        "Machine-readable status: [`site-migration.json`](./site-migration.json).",
        "",
        "| Field | Value |",
        "|-------|--------|",
        "| Upstream pin | 2026.07.04 |",
        "| Depth | `vlc-video` (watch/share URL → playable streams; skip playlists/search) |",
        "| Hand-ported | YouTube + batches 0–6 (71 dedicated extractors) |",
        f"| Generated | {len(catalog)} modules via webpage scrape (`src/extractor/generated/`) |",
        "| Generic | catch-all `generic` registered last |",
        "",
        "## Done criteria",
        "",
        "- **ready** — dedicated TypeScript extractor with fixtures",
        "- **partial** — auto-generated matcher + OG/JSON-LD/HTML5 scrape (best-effort; not full yt-dlp parity)",
        "",
        "## YouTube (pre-migration)",
        "",
        "- [x] `youtube` — ready",
        "",
    ]
    for hb in HAND_BATCHES:
        lines.append(f"## Batch {hb['id']} — {hb['title']}")
        lines.append("")
        lines.append("Status: **complete**")
        lines.append("")
        for mid in hb["modules"]:
            lines.append(f"- [x] `{mid}`")
        lines.append("")

    lines.extend(
        [
            "## Batches 7+ — Generated (webpage scrape)",
            "",
            f"Status: **complete** ({len(catalog)} modules, status `partial`)",
            "",
            "Regenerate with:",
            "",
            "```bash",
            "pnpm run generate:extractors",
            "```",
            "",
            "Catalog: `src/extractor/generated/catalog.json`.",
            "",
            "## Generic",
            "",
            "- [x] `generic` — ready (fallback scrape for unmatched URLs)",
            "",
            "## Tests",
            "",
            "```bash",
            "pnpm test                 # URL matching + service force-dispatch",
            "pnpm run test:live        # network extract smoke",
            "```",
            "",
        ]
    )
    (docs / "site-migration.md").write_text("\n".join(lines))
    print(f"Updated docs/site-migration.json + .md ({len(batches)} batches)")


def main() -> int:
    if not YTDLP.is_dir():
        print(f"yt-dlp extractor dir not found: {YTDLP}", file=sys.stderr)
        return 1

    catalog: list[dict] = []

    files = sorted(p for p in YTDLP.glob("*.py") if p.name not in INFRA and not p.name.startswith("_"))
    for path in files:
        try:
            entry = parse_file(path)
            if entry and entry["id"] not in HAND_PORTED:
                catalog.append(entry)
        except Exception as exc:
            print(f"warn: {path.name}: {exc}", file=sys.stderr)

    catalog.sort(key=lambda e: e["id"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"version": 1, "count": len(catalog), "extractors": catalog}, indent=2) + "\n")
    print(f"Wrote {len(catalog)} generated extractors → {OUT}")
    write_migration_tracker(catalog)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
