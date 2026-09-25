"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  LiveNewsNowIE,
  extractSignedStreamUrl,
  parseCategoryChannelsHtml,
  parseChannelPageUrl,
  parseLnnPseudoId,
  unescapeJsString,
} = require("../../lib/extractor/livenewsnow");
const { registerBuiltInExtractors } = require("../../lib/extractor/register");
const { listVideos, extractInfo } = require("../../lib/index");
const { YoutubeDL } = require("../../lib/core/youtube-dl");

registerBuiltInExtractors();

describe("livenewsnow helpers", () => {
  it("unescapes JS stream URL fragments", () => {
    assert.equal(
      unescapeJsString(
        "https://stream.livenewsplay.com:9443/hls/foxnewssd/index.m3u8?token=abc\\u0026expires=123\\u0026sig=xyz",
      ),
      "https://stream.livenewsplay.com:9443/hls/foxnewssd/index.m3u8?token=abc&expires=123&sig=xyz",
    );
    assert.equal(
      unescapeJsString("https:\\/\\/cdn.livenewsplayer.com\\/hls\\/a.m3u8?x=1"),
      "https://cdn.livenewsplayer.com/hls/a.m3u8?x=1",
    );
  });

  it("parses channel page and pseudo IDs", () => {
    const page = parseChannelPageUrl("https://www.livenewsnow.com/featured/foxnews.html");
    assert.equal(page.section, "featured");
    assert.equal(page.slug, "foxnews");

    assert.deepEqual(parseLnnPseudoId("foxnews"), { kind: "channel", slug: "foxnews" });
    assert.deepEqual(parseLnnPseudoId("featured/foxnews"), {
      kind: "channel",
      section: "featured",
      slug: "foxnews",
    });
    assert.deepEqual(parseLnnPseudoId("american"), { kind: "category", categoryId: "american" });
    assert.deepEqual(parseLnnPseudoId("categories"), { kind: "categories" });
  });

  it("extracts signed streamUrl from player config JSON", () => {
    const html = `
      var C = {"channel":"foxnews","title":"Fox News","streamUrl":"https://stream.livenewsplay.com:9443/hls/foxnewssd/index.m3u8?token=abc\\u0026expires=123\\u0026sig=deadbeef","expiresIn":3600};
    `;
    const url = extractSignedStreamUrl(html);
    assert.equal(
      url,
      "https://stream.livenewsplay.com:9443/hls/foxnewssd/index.m3u8?token=abc&expires=123&sig=deadbeef",
    );
  });

  it("extracts JWPlayer file URLs", () => {
    const html = `
      jwplayer("myElement").setup({
        file: "https://stream.livenewsplayer.com:9555/hls/foxbusiness/index.m3u8?token=t&expires=1&sig=s",
        autostart: true
      });
    `;
    assert.match(extractSignedStreamUrl(html), /foxbusiness\/index\.m3u8\?token=t&expires=1&sig=s/);
  });

  it("parses category channel cards from h3 and div entry titles", () => {
    const html = `
      <h3 class="entry-title td-module-title">
        <a href="https://www.livenewsnow.com/featured/foxnews.html" title="Fox News Live Stream">Fox News Live Stream</a>
      </h3>
      <h3 class="entry-title td-module-title">
        <a href="https://www.livenewsnow.com/american/cnbc.html" title="CNBC (America)">CNBC (America)</a>
      </h3>
      <div class="entry-title td-module-title">
        <a href="https://www.livenewsnow.com/business/fox-business-network-fbn.html" title="Fox Business Live Stream">Fox Business Live Stream</a>
      </div>
      <h3 class="entry-title td-module-title">
        <a href="https://www.livenewsnow.com/updates/some-article.html" title="Article">Article</a>
      </h3>
    `;
    const channels = parseCategoryChannelsHtml(html, "american");
    assert.equal(channels.length, 3);
    assert.ok(channels.some(c => c.id === "foxnews" && c.section === "featured"));
    assert.ok(channels.some(c => c.id === "cnbc" && c.section === "american"));
    assert.ok(
      channels.some(
        c => c.id === "fox-business-network-fbn" && c.section === "business",
      ),
    );
  });
});

describe("livenewsnow suitable / listUrlSupported", () => {
  it("matches channel pages, ids, and list URLs", () => {
    assert.equal(LiveNewsNowIE.suitable("livenewsnow:foxnews"), true);
    assert.equal(LiveNewsNowIE.suitable("livenewsnow:featured/foxnews"), true);
    assert.equal(
      LiveNewsNowIE.suitable("https://www.livenewsnow.com/featured/foxnews.html"),
      true,
    );
    assert.equal(
      LiveNewsNowIE.suitable(
        "https://stream.livenewsplay.com:9443/hls/foxnewssd/index.m3u8?token=a&expires=1&sig=b",
      ),
      true,
    );
    assert.equal(LiveNewsNowIE.suitable("livenewsnow:categories"), false);
    assert.equal(LiveNewsNowIE.suitable("livenewsnow:american"), false);
    assert.equal(
      LiveNewsNowIE.listUrlSupported("https://www.livenewsnow.com/category/american"),
      true,
    );
    assert.equal(LiveNewsNowIE.listUrlSupported("livenewsnow:categories"), true);
    assert.equal(LiveNewsNowIE.listUrlSupported("livenewsnow:american"), true);
  });
});

describe("livenewsnow live", { timeout: 90_000 }, () => {
  it("lists categories american and business", async () => {
    const ydl = new YoutubeDL({ quiet: true, service: "livenewsnow" });
    try {
      const result = await ydl.listCategories("https://www.livenewsnow.com/");
      assert.equal(result.extractor, "livenewsnow");
      assert.ok(result.entries.some(e => e.id === "american"));
      assert.ok(result.entries.some(e => e.id === "business"));
    } finally {
      await ydl.close?.().catch(() => undefined);
    }
  });

  it("lists channel IDs from american category", async () => {
    const result = await listVideos("https://www.livenewsnow.com/category/american", {
      service: "livenewsnow",
    });
    assert.equal(result.extractor, "livenewsnow");
    assert.ok(result.entries.length >= 5);
    const fox = result.entries.find(
      e => e.display_id === "foxnews" || e.id === "foxnews" || /foxnews/i.test(e.url),
    );
    assert.ok(fox, "expected foxnews in american listing");
    assert.match(fox.url, /^livenewsnow:/);
  });

  it("lists every channel across categories by default", async () => {
    const result = await listVideos("livenewsnow:categories", {
      service: "livenewsnow",
    });
    assert.equal(result.extractor, "livenewsnow");
    assert.ok(result.entries.length >= 10);
    const foxNews = result.entries.find(
      e => e.display_id === "foxnews" || e.id === "foxnews" || /foxnews/i.test(e.url || ""),
    );
    const foxBiz = result.entries.find(
      e =>
        e.id === "fox-business-network-fbn" ||
        e.display_id === "fox-business-network-fbn" ||
        /fox-business/i.test(e.url || "") ||
        /fox business/i.test(e.title || ""),
    );
    assert.ok(foxNews, "expected foxnews in all-categories listing");
    assert.ok(foxBiz, "expected Fox Business in all-categories listing");
  });

  it("extracts signed HLS for livenewsnow:foxnews", async () => {
    const info = await extractInfo("livenewsnow:foxnews", { service: "livenewsnow" });
    assert.equal(info.extractor, "livenewsnow");
    assert.equal(info.live_status, "is_live");
    assert.ok(info.formats?.length >= 1);
    const stream = info.formats[0].url;
    assert.match(stream, /livenewsplay(?:er)?\.com/i);
    assert.match(stream, /\.m3u8\?/i);
    assert.match(stream, /(?:token=|secstarttime=|newzstarttime=)/i);

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

  it("extracts from featured foxnews page URL", async () => {
    const info = await extractInfo("https://www.livenewsnow.com/featured/foxnews.html", {
      service: "livenewsnow",
    });
    assert.equal(info.extractor, "livenewsnow");
    assert.match(info.formats[0].url, /\.m3u8\?/);
  });
});
