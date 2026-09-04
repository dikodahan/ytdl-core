"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  AlJazeeraIE,
  normalizeAjChannelId,
  parseAjChannelsHtml,
  resolveAjLiveUrl,
} = require("../../lib/extractor/aljazeera");
const { registerBuiltInExtractors } = require("../../lib/extractor/register");
const { listVideos, extractInfo } = require("../../lib/index");
const { YoutubeDL } = require("../../lib/core/youtube-dl");

registerBuiltInExtractors();

describe("aljazeera helpers", () => {
  it("normalizes channel aliases and live URLs", () => {
    assert.equal(normalizeAjChannelId("english"), "aljazeera-english");
    assert.equal(normalizeAjChannelId("mubasher"), "aljazeera-mubasher");
    assert.match(resolveAjLiveUrl("english"), /aljazeera\.com\/live/);
    assert.equal(resolveAjLiveUrl("aljazeera-media-institute"), null);
  });

  it("parses channel IDs from network channels HTML", () => {
    const html = `
      <h5>Al Jazeera English</h5>
      <div class="read-more"><a href="/en/channels/aljazeera-english">About Channel</a></div>
      <h5>Al Jazeera Arabic</h5>
      <div class="read-more"><a href="/en/channels/aljazeera">About Channel</a></div>
    `;
    const channels = parseAjChannelsHtml(html);
    assert.equal(channels.length, 2);
    assert.equal(channels[0].id, "aljazeera-english");
    assert.equal(channels[1].id, "aljazeera");
    assert.match(channels[0].pageUrl, /\/en\/channels\/aljazeera-english$/);
  });
});

describe("aljazeera suitable / listUrlSupported", () => {
  it("matches channel, live, article, and list URLs", () => {
    assert.equal(AlJazeeraIE.suitable("aljazeera:english"), true);
    assert.equal(
      AlJazeeraIE.suitable("https://network.aljazeera.net/en/channels/aljazeera-english"),
      true,
    );
    assert.equal(AlJazeeraIE.suitable("https://www.aljazeera.com/live"), true);
    assert.equal(
      AlJazeeraIE.suitable(
        "https://balkans.aljazeera.net/videos/2021/11/6/pojedini-domovi-u-sarajevu-jos-pod-vodom-mjestanima-se-dostavlja-hrana",
      ),
      true,
    );
    assert.equal(AlJazeeraIE.suitable("https://network.aljazeera.net/en/channels"), false);
    assert.equal(AlJazeeraIE.listUrlSupported("https://network.aljazeera.net/en/channels"), true);
    assert.equal(AlJazeeraIE.listUrlSupported("aljazeera:channels"), true);
  });
});

describe("aljazeera live", { timeout: 90_000 }, () => {
  it("lists channel IDs from network channels page", async () => {
    const result = await listVideos("https://network.aljazeera.net/en/channels", {
      service: "aljazeera",
    });
    assert.equal(result.extractor, "aljazeera");
    assert.ok(result.entries.length >= 4);
    const english = result.entries.find(e => e.id === "aljazeera-english");
    assert.ok(english);
    assert.equal(english.url, "aljazeera:aljazeera-english");
    assert.match(english.title, /English/i);
  });

  it("extracts HLS for English live via channel ID", async () => {
    const info = await extractInfo("aljazeera:english", { service: "aljazeera" });
    assert.equal(info.extractor, "aljazeera");
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

  it("extracts Brightcove article from balkans.aljazeera.net", async () => {
    const info = await extractInfo(
      "https://balkans.aljazeera.net/videos/2021/11/6/pojedini-domovi-u-sarajevu-jos-pod-vodom-mjestanima-se-dostavlja-hrana",
      { service: "aljazeera" },
    );
    assert.equal(info.extractor, "aljazeera");
    assert.ok(info.formats?.length >= 1);
    assert.ok(info.id);
  });
});
