"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  GbnewsIE,
  normalizeGbnewsChannelId,
  parseGbnewsChannelsHtml,
  parseGbnewsPlayerConfig,
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

  it("parses player config and channel list from watch HTML", () => {
    const html = `
      <div class="simplestream live_player" data-id="GB005" data-key="3Li3Nt2Qs8Ct3Xq9Fi5Uy0Mb2Bj0Qs"
        data-uvid="1069" data-poster="https://thumbnails.simplestreamcdn.com/gbnews/channel/1069.jpg" data-title="watch live"></div>
      <a href="https://www.gbnews.com/watch/live" id="gbnLink">GBN 1 Live</a>
      <a href="https://www.gbnews.com/watch/live-2" id="gbn2Link">GBN 2 Live</a>
    `;
    const cfg = parseGbnewsPlayerConfig(html);
    assert.equal(cfg.uvid, "1069");
    assert.equal(cfg.playerId, "GB005");
    const channels = parseGbnewsChannelsHtml(html);
    assert.ok(channels.length >= 2);
    assert.ok(channels.some(c => c.slug === "gbn1" && c.uvid === "1069"));
    assert.ok(channels.some(c => c.slug === "gbn2"));
  });
});

describe("gbnews suitable / listUrlSupported", () => {
  it("matches live pages, uvids, and list URLs", () => {
    assert.equal(GbnewsIE.suitable("gbnews:gbn1"), true);
    assert.equal(GbnewsIE.suitable("gbnews:1069"), true);
    assert.equal(GbnewsIE.suitable("https://www.gbnews.com/watch/live"), true);
    assert.equal(GbnewsIE.suitable("https://www.gbnews.com/watch/live-2"), true);
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
    assert.ok(result.entries.length >= 2);
    const gbn1 = result.entries.find(e => e.display_id === "gbn1" || e.url === "gbnews:gbn1");
    assert.ok(gbn1);
    assert.match(gbn1.id, /^\d+$/);
    assert.equal(gbn1.url, "gbnews:gbn1");
  });

  it("extracts HLS for gbnews:gbn1", async () => {
    const info = await extractInfo("gbnews:gbn1", { service: "gbnews" });
    assert.equal(info.extractor, "gbnews");
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

  it("extracts from watch/live page", async () => {
    const info = await extractInfo("https://www.gbnews.com/watch/live", { service: "gbnews" });
    assert.equal(info.extractor, "gbnews");
    assert.match(info.formats[0].url, /simplestreamcdn|\.m3u8/i);
  });
});
