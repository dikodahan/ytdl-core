"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { I24IE, pickPrimaryLiveChannel } = require("../../lib/extractor/i24");
const { registerBuiltInExtractors } = require("../../lib/extractor/register");
const { listVideos, extractInfo } = require("../../lib/index");
const { YoutubeDL } = require("../../lib/core/youtube-dl");

registerBuiltInExtractors();

describe("i24 helpers", () => {
  it("picks region-matching primary live channel", () => {
    const channels = [
      { id: "1", title: "I24NEWS English", videoUrl: "https://a/master.m3u8", regionCode: "hebrew" },
      { id: "2", title: "i24NEWS Hebrew", videoUrl: "https://b/master.m3u8", regionCode: "hebrew" },
    ];
    assert.equal(pickPrimaryLiveChannel(channels, "hebrew").id, "2");
    assert.equal(pickPrimaryLiveChannel(channels, "all").id, "1");
  });
});

describe("i24 suitable / listUrlSupported", () => {
  it("matches region pages, channels, and regions listing", () => {
    assert.equal(
      I24IE.suitable("https://video.i24news.tv/r/hebrew/page/6875657dd9a706e53126829d"),
      true,
    );
    assert.equal(I24IE.suitable("i24:hebrew"), true);
    assert.equal(
      I24IE.suitable("https://video.i24news.tv/player/channel/69b17e029abd89c807678067"),
      true,
    );
    assert.equal(I24IE.suitable("https://video.i24news.tv/regions"), false);
    assert.equal(I24IE.listUrlSupported("https://video.i24news.tv/regions"), true);
    assert.equal(
      I24IE.listUrlSupported("https://video.i24news.tv/r/hebrew/page/6875657dd9a706e53126829d"),
      true,
    );
  });
});

describe("i24 live", { timeout: 60_000 }, () => {
  it("lists region page IDs from /regions", async () => {
    const result = await listVideos("https://video.i24news.tv/regions", { service: "i24" });
    assert.equal(result.extractor, "i24");
    assert.ok(result.entries.length >= 4);
    const hebrew = result.entries.find(e => e.display_id === "hebrew" || /hebrew/i.test(e.url));
    assert.ok(hebrew);
    assert.match(hebrew.id, /^[a-f0-9]{24}$/);
    assert.match(hebrew.url, /video\.i24news\.tv\/r\/hebrew\/page\//);
  });

  it("lists live channel IDs from a hebrew region page", async () => {
    const regions = await listVideos("https://video.i24news.tv/regions", { service: "i24" });
    const hebrew = regions.entries.find(e => /\/r\/hebrew\//.test(e.url));
    assert.ok(hebrew);
    const result = await listVideos(hebrew.url, { service: "i24", limit: 5 });
    assert.ok(result.entries.length >= 1);
    for (const entry of result.entries) {
      assert.match(entry.id, /^[a-f0-9]{24}$/);
      assert.match(entry.url, /\/player\/channel\//);
    }
  });

  it("extracts HLS for hebrew region page", async () => {
    const info = await extractInfo(
      "https://video.i24news.tv/r/hebrew/page/6875657dd9a706e53126829d",
      { service: "i24" },
    );
    assert.equal(info.extractor, "i24");
    assert.equal(info.live_status, "is_live");
    assert.ok(info.formats?.length >= 1);
    assert.match(info.formats[0].url, /\.m3u8($|\?)/i);

    const ydl = new YoutubeDL({ quiet: true });
    try {
      const res = await ydl.request.request(info.formats[0].url, {
        headers: info.formats[0].http_headers,
      });
      assert.equal(res.statusCode, 200);
      assert.match(res.body, /#EXTM3U/);
    } finally {
      await ydl.close?.().catch(() => undefined);
    }
  });

  it("extracts via i24:hebrew pseudo-URL", async () => {
    const info = await extractInfo("i24:hebrew", { service: "i24" });
    assert.equal(info.extractor, "i24");
    assert.match(info.formats[0].url, /hebrew|i24news/i);
  });
});
