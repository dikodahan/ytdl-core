"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeChannel,
  isCountryScope,
  channelPageUrl,
} = require("../../lib/extractor/famelack/famelack-data");
const { registerBuiltInExtractors } = require("../../lib/extractor/register");
const { resolveExtractor, resolveListExtractor } = require("../../lib/core/registry");
const { listVideos } = require("../../lib/index");

registerBuiltInExtractors();

describe("famelack helpers", () => {
  it("normalizes channel streams and youtube sources", () => {
    const channel = normalizeChannel({
      nanoid: "BTtTvg520N96K8",
      name: "3ABN English",
      sources: {
        streams: ["https://example.com/live.m3u8"],
        youtube: ["https://www.youtube-nocookie.com/embed/abc12345678"],
      },
      languages: ["eng"],
      country: "us",
      isGeoBlocked: false,
    });
    assert.equal(channel.nanoid, "BTtTvg520N96K8");
    assert.equal(channel.streamUrls.length, 1);
    assert.equal(channel.youtubeUrls.length, 1);
    assert.equal(isCountryScope("us"), true);
    assert.equal(isCountryScope("news"), false);
    assert.equal(channelPageUrl("us", "BTtTvg520N96K8"), "https://famelack.com/tv/us/BTtTvg520N96K8");
  });
});

describe("famelack extractor", () => {
  it("matches channel and listing URLs", () => {
    assert.ok(resolveExtractor("https://famelack.com/tv/us/BTtTvg520N96K8"));
    assert.ok(resolveListExtractor("https://famelack.com/tv/us", "famelack"));
    assert.throws(
      () => resolveListExtractor("https://famelack.com/tv/us/BTtTvg520N96K8", "famelack"),
      /not a supported listing page/,
    );
  });

  it("listVideos returns channel ids (live)", { timeout: 30_000 }, async () => {
    const result = await listVideos("https://famelack.com/tv/us", { service: "famelack", limit: 5 });
    assert.equal(result.extractor, "famelack");
    assert.ok(result.entries.length >= 1);
    for (const entry of result.entries) {
      assert.match(entry.id, /^[A-Za-z0-9]+$/);
      assert.match(entry.url, /^https:\/\/famelack\.com\/tv\/us\//);
      assert.ok(entry.title);
    }
  });

  it("extract returns HLS formats (live)", { timeout: 30_000 }, async () => {
    const { extractInfo } = require("../../lib/index");
    const info = await extractInfo("https://famelack.com/tv/us/BTtTvg520N96K8", { service: "famelack" });
    assert.equal(info.extractor, "famelack");
    assert.equal(info.id, "BTtTvg520N96K8");
    assert.ok(info.formats?.length >= 1);
    assert.ok(info.formats.some(f => f.url.includes(".m3u8") || f.protocol === "m3u8_native"));
  });
});
