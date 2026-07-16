"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { registerBuiltInExtractors } = require("../../lib/extractor/register");
const { resolveExtractor, resolveListExtractor } = require("../../lib/core/registry");
const { pickChannelLogo, pickStreamFormats } = require("../../lib/extractor/kaltura-ott/client");
const { resolvePartnerPreset } = require("../../lib/extractor/kaltura-ott/presets");
const { listVideos, extractInfo } = require("../../lib/index");

registerBuiltInExtractors();

describe("kaltura-ott presets", () => {
  it("resolves reshet and cellcom aliases", () => {
    assert.equal(resolvePartnerPreset("reshet")?.partnerId, 5031);
    assert.equal(resolvePartnerPreset("cellcom")?.partnerId, 3197);
    assert.equal(resolvePartnerPreset("5031")?.partnerId, 5031);
  });
});

describe("kaltura-ott helpers", () => {
  it("pickChannelLogo prefers TVGuide_1x1", () => {
    const url = pickChannelLogo([
      { imageTypeName: "16x9", url: "https://example.com/16x9.png" },
      { imageTypeName: "TVGuide_1x1", url: "https://example.com/guide.png" },
    ]);
    assert.equal(url, "https://example.com/guide.png");
  });

  it("pickStreamFormats finds hls and dash", () => {
    const { hls, dash } = pickStreamFormats([
      { type: "dash_widevine", url: "https://example.com/live.mpd" },
      { type: "HLS", url: "https://example.com/live.m3u8" },
    ]);
    assert.match(hls, /\.m3u8$/);
    assert.match(dash, /\.mpd$/);
  });
});

describe("kaltura-ott extractor routing", () => {
  it("matches live and program extract URLs", () => {
    assert.ok(resolveExtractor("kaltura-ott:reshet:live:2605018", "kaltura-ott"));
    assert.ok(resolveExtractor("kaltura-ott:cellcom:program:123456", "kaltura-ott"));
    assert.throws(
      () => resolveExtractor("kaltura-ott:reshet:channels", "kaltura-ott"),
      /not valid for service/,
    );
  });

  it("matches listing URLs", () => {
    assert.ok(resolveListExtractor("kaltura-ott:reshet:channels", "kaltura-ott"));
    assert.ok(resolveListExtractor("kaltura-ott:cellcom:epg:3728", "kaltura-ott"));
    assert.throws(
      () => resolveListExtractor("kaltura-ott:reshet:live:2605018", "kaltura-ott"),
      /not a supported listing page/,
    );
  });
});

describe("kaltura-ott live API", () => {
  it("lists Reshet channels", { timeout: 30_000 }, async () => {
    const result = await listVideos("kaltura-ott:reshet:channels", {
      service: "kaltura-ott",
      limit: 10,
    });
    assert.equal(result.extractor, "kaltura-ott");
    assert.ok(result.entries.length >= 1);
    for (const entry of result.entries) {
      assert.match(entry.id, /^\d+$/);
      assert.match(entry.url, /^kaltura-ott:reshet:live:\d+$/);
      if (entry.thumbnail) assert.match(entry.thumbnail, /^https?:\/\//);
    }
  });

  it("lists Reshet EPG programs", { timeout: 45_000 }, async () => {
    const channels = await listVideos("kaltura-ott:reshet:channels", {
      service: "kaltura-ott",
      limit: 1,
    });
    const channelId = channels.entries[0]?.id;
    assert.ok(channelId, "need a channel id");

    const epg = await listVideos(`kaltura-ott:reshet:epg:${channelId}?days=1`, {
      service: "kaltura-ott",
      limit: 5,
    });
    assert.equal(epg.extractor, "kaltura-ott");
    assert.ok(epg.entries.length >= 1);
    for (const entry of epg.entries) {
      assert.match(entry.id, /^\d+$/);
      assert.match(entry.url, /^kaltura-ott:reshet:program:\d+/);
    }
  });

  it("extracts Reshet live HLS", { timeout: 30_000 }, async () => {
    const channels = await listVideos("kaltura-ott:reshet:channels", {
      service: "kaltura-ott",
      limit: 1,
    });
    const url = channels.entries[0]?.url;
    assert.ok(url);

    const info = await extractInfo(url, { service: "kaltura-ott" });
    assert.equal(info.extractor, "kaltura-ott");
    assert.ok(info.formats?.length >= 1);
    const hls = info.formats.find(f => f.format_id === "hls" || f.isHLS);
    assert.ok(hls?.url, "expected HLS manifest URL");
    assert.match(hls.url, /^https?:\/\//);
  });

  it("lists Cellcom channels", { timeout: 30_000 }, async () => {
    const result = await listVideos("kaltura-ott:cellcom:channels", {
      service: "kaltura-ott",
      limit: 5,
    });
    assert.equal(result.extractor, "kaltura-ott");
    assert.ok(result.entries.length >= 1);
    assert.match(result.entries[0].url, /^kaltura-ott:cellcom:live:\d+$/);
  });
});
