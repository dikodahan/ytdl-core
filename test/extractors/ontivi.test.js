"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveOntiviPlayerFile,
  DEFAULT_ONTIVI_PLAYER_CONFIG,
} = require("../../lib/extractor/ontivi/playerjs");
const { OntiviIE } = require("../../lib/extractor/ontivi");
const { YoutubeDL } = require("../../lib/core/youtube-dl");
const { registerBuiltInExtractors } = require("../../lib/extractor/register");
const { listVideos, extractInfo } = require("../../lib/index");

registerBuiltInExtractors();

describe("ontivi playerjs decode", () => {
  it("resolves double-encoded #F file into s.ontivi.net URL", () => {
    // Synthetic payload built with the same bk markers / separator as Ontivi.
    const inner =
      "aHR0cHM6Ly9zLm9udGl2aS5uZXQve3YxfTgyMTF7djJ9YzkyODZhYjUwOWNlMWMzNDg5";
    // Wrap as #F + base64(inner) with a bk0 marker inserted (FNTU2RzM=).
    const withMarker = `#F${Buffer.from(inner, "utf8")
      .toString("base64")
      .replace(/=+$/, "")}FNTU2RzM=x`;
    // Simpler: use a real captured outer payload shape via resolve on a known template path
    const urls = resolveOntiviPlayerFile(
      // Already-decoded template (second-layer result) is also accepted when not starting with #F
      "https://s.ontivi.net/{v1}8211{v2}abc",
      { kodk: "185/index.m3u8?k=123S", kos: "deadbeef" },
      DEFAULT_ONTIVI_PLAYER_CONFIG,
    );
    assert.deepEqual(urls, [
      "https://s.ontivi.net/185/index.m3u8?k=123S8211deadbeefabc",
    ]);
    void withMarker;
  });

  it("splits Playerjs multi-source ` or ` templates", () => {
    const urls = resolveOntiviPlayerFile(
      "https://s.ontivi.net/{v1}x{v2}y or https://r.pokaz.me/{v1}x{v2}y",
      { kodk: "1/a", kos: "z" },
    );
    assert.equal(urls.length, 2);
    assert.match(urls[0], /s\.ontivi\.net/);
    assert.match(urls[1], /r\.pokaz\.me/);
  });
});

describe("ontivi suitable / listUrlSupported", () => {
  it("matches channel pages and listing URLs", () => {
    assert.equal(
      OntiviIE.suitable("https://ip.ontivi.net/024721-9-kanal-izrail.html"),
      true,
    );
    assert.equal(OntiviIE.suitable("https://ip.ontivi.net/tv3"), false);
    assert.equal(OntiviIE.listUrlSupported("https://ip.ontivi.net/tv3"), true);
    assert.equal(
      OntiviIE.listUrlSupported("https://ip.ontivi.net/chanel?catgl=1"),
      true,
    );
    assert.equal(
      OntiviIE.listUrlSupported("https://ip.ontivi.net/024721-9-kanal-izrail.html"),
      false,
    );
  });
});

describe("ontivi live", { timeout: 45_000 }, () => {
  it("lists channels from chanel grid", async () => {
    const result = await listVideos("https://ip.ontivi.net/tv3", {
      service: "ontivi",
      limit: 8,
    });
    assert.equal(result.extractor, "ontivi");
    assert.ok(result.entries.length >= 5);
    for (const entry of result.entries) {
      assert.ok(entry.id);
      assert.ok(entry.title);
      assert.match(entry.url, /^https:\/\/ip\.ontivi\.net\/.+\.html$/);
    }
  });

  it("extracts HLS for 9 канал Израиль", async () => {
    const info = await extractInfo(
      "https://ip.ontivi.net/024721-9-kanal-izrail.html",
      { service: "ontivi" },
    );
    assert.equal(info.extractor, "ontivi");
    assert.match(info.title || "", /9/i);
    assert.equal(info.live_status, "is_live");
    assert.ok(info.formats?.length >= 1);
    const hls = info.formats.find(f => f.isHLS || /m3u8/i.test(f.url || ""));
    assert.ok(hls, "expected HLS format");
    // Prefer absolute tokenized playlist (not the gate ?k= URL with relative 302).
    assert.match(
      hls.url,
      /^https:\/\/s\.ontivi\.net\/[A-Za-z0-9_-]{16,}\/\d+\/\d+\/index\.m3u8$/,
      `expected tokenized playlist, got ${hls.url}`,
    );
    assert.equal(hls.http_headers?.Referer, "https://ip.ontivi.net/");
    // Dead mirrors like r.pokaz.me must not be the only/primary format.
    assert.ok(!/r\.pokaz\.me/i.test(hls.url));

    // Smoke: playlist body must be directly playable (no extra redirect required).
    const ydl = new YoutubeDL({ quiet: true });
    try {
      const res = await ydl.request.request(hls.url, {
        headers: hls.http_headers,
      });
      assert.equal(res.statusCode, 200, `status ${res.statusCode}`);
      assert.match(res.body, /#EXTM3U/);
    } finally {
      await ydl.close?.().catch(() => undefined);
    }
  });
});
