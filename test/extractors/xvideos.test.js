"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseXvideosCategories,
  parseXvideosEntries,
  parseXvideosNextPage,
} = require("../../lib/extractor/_shared/page-links");
const { XVideosIE } = require("../../lib/extractor/xvideos");
const { registerBuiltInExtractors } = require("../../lib/extractor/register");
const { listVideos, extractInfo } = require("../../lib/index");
const { YoutubeDL } = require("../../lib/core/youtube-dl");

registerBuiltInExtractors();

describe("parseXvideosCategories", () => {
  it("parses /c/{Name}-{id} menu links", () => {
    const html = `
      <a href="/c/Amateur-65">Amateur</a>
      <a href="/c/Asian_Woman-32">Asian</a>
      <a href="/c/Amateur-65/1">2</a>
    `;
    const entries = parseXvideosCategories(html, "https://www.xvideos.com/");
    assert.equal(entries.length, 2);
    const amateur = entries.find(e => e.id === "65");
    assert.ok(amateur);
    assert.equal(amateur.title, "Amateur");
    assert.equal(amateur.url, "https://www.xvideos.com/c/Amateur-65");
    assert.equal(amateur.display_id, "Amateur-65");
    assert.ok(entries.some(e => e.id === "32" && e.title === "Asian"));
  });
});

describe("parseXvideosEntries", () => {
  it("parses thumb-block video tiles", () => {
    const html = `
      <div id="video_oopthhhf76d" data-id="89522449" data-eid="oopthhhf76d" class="thumb-block">
        <a href="/video.oopthhhf76d/night_amateur_fuck">
          <img data-src="https://thumb.example/xv.jpg" data-mzl="https://thumb.example/moz.jpg" />
        </a>
        <p class="title"><a href="/video.oopthhhf76d/night_amateur_fuck" title="Night Amateur Fuck">Night Amateur Fuck</a></p>
      </div>
      <div id="video_lpmlcl83c7" data-eid="lpmlcl83c7" class="thumb-block">
        <a href="/video.lpmlcl83c7/18_years_old_amateur" title="18 years old amateur">x</a>
      </div>
    `;
    const entries = parseXvideosEntries(html, "https://www.xvideos.com/c/Amateur-65");
    assert.equal(entries.length, 2);
    assert.equal(entries[0].id, "oopthhhf76d");
    assert.equal(
      entries[0].url,
      "https://www.xvideos.com/video.oopthhhf76d/night_amateur_fuck",
    );
    assert.equal(entries[0].title, "Night Amateur Fuck");
    assert.equal(entries[0].thumbnail, "https://thumb.example/moz.jpg");
    assert.equal(entries[1].id, "lpmlcl83c7");
  });

  it("parses next-page link", () => {
    const html = `<li><a href="/c/Amateur-65/1" class="no-page next-page">Next</a></li>`;
    assert.equal(
      parseXvideosNextPage(html, "https://www.xvideos.com/c/Amateur-65"),
      "https://www.xvideos.com/c/Amateur-65/1",
    );
  });
});

describe("xvideos suitable / listUrlSupported", () => {
  it("matches watch and category URLs", () => {
    assert.equal(
      XVideosIE.suitable("https://www.xvideos.com/video.oopthhhf76d/night_amateur_fuck"),
      true,
    );
    assert.equal(XVideosIE.suitable("https://www.xvideos.com/c/Amateur-65"), false);
    assert.equal(XVideosIE.listUrlSupported("https://www.xvideos.com/c/Amateur-65"), true);
    assert.equal(XVideosIE.listUrlSupported("https://www.xvideos.com/c/Asian_Woman-32"), true);
    assert.equal(XVideosIE.listUrlSupported("https://www.xvideos.com/"), true);
    assert.equal(
      XVideosIE.listUrlSupported("https://www.xvideos.com/video.oopthhhf76d/night"),
      false,
    );
  });
});

describe("xvideos live", { timeout: 60_000 }, () => {
  it("lists categories from homepage menu", async () => {
    const ydl = new YoutubeDL({ quiet: true, site: "xvideos" });
    try {
      const result = await ydl.listCategories("https://www.xvideos.com/", { limit: 20 });
      assert.equal(result.extractor, "xvideos");
      assert.ok(result.entries.length >= 5);
      const amateur = result.entries.find(
        e => e.id === "65" || /amateur/i.test(e.title || "") || /Amateur-65/.test(e.url),
      );
      assert.ok(amateur, "expected Amateur category");
      assert.match(amateur.url, /xvideos\.com\/c\//);
    } finally {
      await ydl.close?.().catch(() => undefined);
    }
  });

  it("lists video ids from Amateur category", async () => {
    const result = await listVideos("https://www.xvideos.com/c/Amateur-65", {
      service: "xvideos",
      limit: 5,
    });
    assert.equal(result.extractor, "xvideos");
    assert.ok(result.entries.length >= 1);
    assert.ok(result.next_page_url);
    for (const entry of result.entries) {
      assert.match(entry.id, /^[a-z0-9]+$/i);
      assert.match(entry.url, /xvideos\.com\/video\./);
    }
  });

  it("extracts MP4/HLS formats for a listed video", async () => {
    const list = await listVideos("https://www.xvideos.com/c/Amateur-65", {
      service: "xvideos",
      limit: 1,
    });
    const url = list.entries[0].url;
    const info = await extractInfo(url, { service: "xvideos" });
    assert.equal(info.extractor, "xvideos");
    assert.equal(info.age_limit, 18);
    assert.ok(info.formats?.length >= 1);
    assert.ok(
      info.formats.some(f => /\.m3u8($|\?)/i.test(f.url) || /\.mp4($|\?)/i.test(f.url)),
    );
  });
});
