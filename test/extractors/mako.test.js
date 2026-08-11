"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildAuthorizedMakoUrl,
  MAKO_CHANNELS,
  findMakoChannel,
  clearMakoDiscoveryCache,
  collectLiveTvEntries,
  mergeMakoCatalog,
  selectMakoCatalog,
  stableIdForSiteChannel,
} = require("../../lib/extractor/mako");
const { MakoIE } = require("../../lib/extractor/mako");
const { registerBuiltInExtractors } = require("../../lib/extractor/register");
const { listVideos, extractInfo } = require("../../lib/index");
const { YoutubeDL } = require("../../lib/core/youtube-dl");

registerBuiltInExtractors();

describe("mako catalog", () => {
  it("has keshet 12 and channel 24 entries", () => {
    assert.ok(findMakoChannel("k12"));
    assert.ok(findMakoChannel("ch24"));
    assert.ok(MAKO_CHANNELS.length >= 8);
    assert.match(findMakoChannel("k12").streamUrl, /mako-streaming\.akamaized\.net/);
  });

  it("appends hdnea ticket to stream URL", () => {
    const url = buildAuthorizedMakoUrl(
      "https://mako-streaming.akamaized.net/x/index.m3u8",
      "hdnea=st%3D1%7Eexp%3D2",
    );
    assert.equal(
      url,
      "https://mako-streaming.akamaized.net/x/index.m3u8?hdnea=st%3D1%7Eexp%3D2",
    );
    const url2 = buildAuthorizedMakoUrl(
      "https://mako-streaming.akamaized.net/x/index.m3u8?foo=1",
      "hdnea=abc",
    );
    assert.equal(url2, "https://mako-streaming.akamaized.net/x/index.m3u8?foo=1&hdnea=abc");
  });

  it("maps site paths and stream segments to stable ids", () => {
    assert.equal(
      stableIdForSiteChannel({ pageUrl: "/mako-vod-live-tv/comedy_nonstop" }),
      "free-comedy",
    );
    assert.equal(
      stableIdForSiteChannel({
        pageUrl: "/mako-vod-live-tv/unknown_show",
        streamUrl: "https://mako-streaming.akamaized.net/free/hls/live/1/erets/index.m3u8",
      }),
      "eretz",
    );
  });

  it("uses site catalog alone when discovery succeeds", () => {
    const selected = selectMakoCatalog(
      [
        {
          id: "k12",
          name: "Site K12",
          label: "k12",
          streamUrl: "https://mako-streaming.akamaized.net/stream/hls/live/1/k12rh-dvr/index.m3u8",
          group: "live",
        },
      ],
      MAKO_CHANNELS,
    );
    assert.equal(selected.source, "site");
    assert.equal(selected.channels.length, 1);
    assert.equal(selected.channels[0].name, "Site K12");
    assert.equal(
      selected.channels.some(c => c.id === "ninja"),
      false,
      "fallback extras must not mix into a successful site catalog",
    );
  });

  it("uses MediaBox fallback only when site discovery is empty", () => {
    const selected = selectMakoCatalog([], MAKO_CHANNELS);
    assert.equal(selected.source, "fallback");
    assert.ok(selected.channels.length >= 8);
    assert.ok(selected.channels.find(c => c.id === "ninja"));
    // mergeMakoCatalog mirrors select().channels
    assert.equal(mergeMakoCatalog([], MAKO_CHANNELS).length, selected.channels.length);
  });

  it("collects live-tv rail entries from NEXT_DATA-shaped JSON", () => {
    const entries = collectLiveTvEntries({
      props: {
        pageProps: {
          data: {
            rails: [
              {
                pageUrl: "/mako-vod-live-tv/comedy_nonstop",
                itemVcmId: "abc",
                title: "Comedy",
              },
              {
                pageUrl: "/mako-vod-live-tv/comedy_nonstop-s1/VOD-914a.htm",
                itemVcmId: "skip-me",
              },
              {
                pageUrl: "https://www.mako.co.il/mako-vod-live-tv/VOD-6540b8dcb64fd31006.htm",
                title: "LIVE12",
              },
            ],
          },
        },
      },
    });
    assert.equal(entries.length, 2);
    assert.ok(entries.some(e => e.pageUrl.endsWith("/comedy_nonstop")));
    assert.ok(entries.some(e => e.pageUrl.includes("VOD-6540")));
  });
});

describe("mako suitable / listUrlSupported", () => {
  it("matches channel extract and listing URLs", () => {
    assert.equal(MakoIE.suitable("mako:k12"), true);
    assert.equal(MakoIE.suitable("mako:brand-new-channel"), true);
    assert.equal(MakoIE.suitable("mako:channels"), false);
    assert.equal(MakoIE.listUrlSupported("mako:channels"), true);
    assert.equal(MakoIE.listUrlSupported("mako:channels:free"), true);
    assert.equal(MakoIE.listUrlSupported("mako:k12"), false);
    assert.equal(
      MakoIE.suitable(
        "https://mako-streaming.akamaized.net/direct/hls/live/2035340/ch24live/index.m3u8",
      ),
      true,
    );
  });
});

describe("mako live", { timeout: 120_000 }, () => {
  it("lists channel IDs from site discovery only", async () => {
    clearMakoDiscoveryCache();
    const result = await listVideos("mako:channels", { service: "mako" });
    assert.equal(result.extractor, "mako");
    assert.ok(result.entries.length >= 8);
    const k12 = result.entries.find(e => e.id === "k12");
    assert.ok(k12);
    assert.equal(k12.url, "mako:k12");
    // Site-only: MediaBox extras omitted when discovery succeeds.
    assert.equal(result.entries.some(e => e.id === "ninja"), false);
    assert.equal(result.entries.some(e => e.id === "dancing"), false);
    assert.match(result.playlist_title, /site|fallback/);
  });

  it("extracts tokenized HLS for Keshet 12", async () => {
    clearMakoDiscoveryCache();
    const info = await extractInfo("mako:k12", { service: "mako" });
    assert.equal(info.extractor, "mako");
    assert.equal(info.id, "k12");
    assert.equal(info.live_status, "is_live");
    assert.ok(info.formats?.length >= 1);
    const hls = info.formats[0];
    assert.match(hls.url, /mako-streaming\.akamaized\.net/);
    assert.match(hls.url, /[?&]hdnea=/);
    assert.equal(hls.http_headers?.Referer, "https://www.mako.co.il/");

    const ydl = new YoutubeDL({ quiet: true });
    try {
      const res = await ydl.request.request(hls.url, { headers: hls.http_headers });
      assert.equal(res.statusCode, 200, `status ${res.statusCode}`);
      assert.match(res.body, /#EXTM3U/);
    } finally {
      await ydl.close?.().catch(() => undefined);
    }
  });
});
