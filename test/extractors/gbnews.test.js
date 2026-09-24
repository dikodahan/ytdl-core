"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  GbnewsIE,
  normalizeGbnewsChannelId,
  parseGbnewsChannelsHtml,
  parseGbnewsPlayerConfig,
  withHlsClientParams,
} = require("../../lib/extractor/gbnews");
const { registerBuiltInExtractors } = require("../../lib/extractor/register");
const { listVideos, extractInfo } = require("../../lib/index");
const { YoutubeDL } = require("../../lib/core/youtube-dl");

registerBuiltInExtractors();

describe("gbnews helpers", () => {
  it("normalizes channel aliases", () => {
    assert.equal(normalizeGbnewsChannelId("live"), "gbn1");
    assert.equal(normalizeGbnewsChannelId("live-2"), "gbn2");
    assert.equal(normalizeGbnewsChannelId("GBN-1"), "gbn1");
  });

  it("appends HLS client params", () => {
    const url = withHlsClientParams(
      "https://gbnews.perception.tv/Catherine/stream/hls.m3u8?mwk=abc123",
    );
    assert.match(url, /mwk=abc123/);
    assert.match(url, /client=hlsjs/);
    assert.match(url, /[?&]v=6/);
    assert.match(url, /initialBandwidthLimit=2097153/);
  });

  it("parses player config and channel list from watch HTML", () => {
    const html = `
      <iframe src="https://gbnews.perception.tv/player/tv/385?parentOrigin=https%3A%2F%2Fwww.gbnews.com"></iframe>
      <a href="https://www.gbnews.com/watch/live" id="gbnLink">GBN 1 Live</a>
      <a href="https://www.gbnews.com/watch/live-2" id="gbn2Link">GBN 2 Live</a>
    `;
    const cfg = parseGbnewsPlayerConfig(html);
    assert.equal(cfg.channelId, "385");
    const channels = parseGbnewsChannelsHtml(html);
    assert.ok(channels.length >= 2);
    assert.ok(channels.some(c => c.slug === "gbn1" && c.id === "385"));
    assert.ok(channels.some(c => c.slug === "gbn2"));
  });
});

describe("gbnews suitable / listUrlSupported", () => {
  it("matches live pages, channel ids, and list URLs", () => {
    assert.equal(GbnewsIE.suitable("gbnews:gbn1"), true);
    assert.equal(GbnewsIE.suitable("gbnews:385"), true);
    assert.equal(GbnewsIE.suitable("https://www.gbnews.com/watch/live"), true);
    assert.equal(
      GbnewsIE.suitable(
        "https://gbnews.perception.tv/Catherine/stream/hls.m3u8?mwk=0520dbb2477448ba847b6dc5234f8f1a",
      ),
      true,
    );
    assert.equal(GbnewsIE.suitable("gbnews:channels"), false);
    assert.equal(GbnewsIE.listUrlSupported("https://www.gbnews.com/watch/live"), true);
    assert.equal(GbnewsIE.listUrlSupported("gbnews:channels"), true);
  });
});

describe("gbnews live", { timeout: 60_000 }, () => {
  it("lists channel IDs from watch/live", async () => {
    const result = await listVideos("https://www.gbnews.com/watch/live", { service: "gbnews" });
    assert.equal(result.extractor, "gbnews");
    assert.ok(result.entries.length >= 1);
    const gbn1 = result.entries.find(e => e.display_id === "gbn1" || e.url === "gbnews:gbn1");
    assert.ok(gbn1);
    assert.match(gbn1.id, /^\d+$/);
    assert.equal(gbn1.url, "gbnews:gbn1");
  });

  it("extracts Perception mwk HLS for gbnews:gbn1", async () => {
    const info = await extractInfo("gbnews:gbn1", { service: "gbnews" });
    assert.equal(info.extractor, "gbnews");
    assert.equal(info.live_status, "is_live");
    assert.ok(info.formats?.length >= 1);
    const stream = info.formats[0].url;
    assert.match(stream, /perception\.tv\/Catherine\/stream\/hls\.m3u8/i);
    assert.match(stream, /[?&]mwk=[a-f0-9]+/i);
    assert.match(stream, /client=hlsjs/);
    assert.match(stream, /[?&]v=6/);

    const ydl = new YoutubeDL({ quiet: true });
    try {
      const res = await ydl.request.request(stream, {
        headers: info.formats[0].http_headers,
      });
      assert.equal(res.statusCode, 200);
      assert.match(res.body, /#EXTM3U/);
    } finally {
      await ydl.close?.().catch(() => undefined);
    }
  });

  it("extracts from watch/live page", async () => {
    const info = await extractInfo("https://www.gbnews.com/watch/live", { service: "gbnews" });
    assert.equal(info.extractor, "gbnews");
    assert.match(info.formats[0].url, /perception\.tv.*mwk=/i);
  });
});
