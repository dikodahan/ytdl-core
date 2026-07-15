"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { parseXnxxCategories, parseXnxxEntries } = require("../../lib/extractor/_shared/page-links");

describe("parseXnxxCategories", () => {
  it("parses categories from homepage xv.conf JSON", () => {
    const html = `
      <script>window.xv={};window.xv.conf={"dyn":{"categories":[
        {"label":"Amateur","url":"/search/amateur","cat_id":65,"type":"cat"},
        {"label":"Milf","url":"/search/milf","cat_id":19,"type":"cat"}
      ]}};</script>
    `;
    const entries = parseXnxxCategories(html, "https://www.xnxx.com/");
    const amateur = entries.find(entry => entry.id === "65");
    assert.ok(amateur);
    assert.equal(amateur.title, "Amateur");
    assert.equal(amateur.url, "https://www.xnxx.com/search/amateur/");
    assert.equal(amateur.display_id, "amateur");
    assert.ok(entries.some(entry => entry.id === "19"));
  });

  it("parses category thumbnails from write_thumb_block_list", () => {
    const html = `
      <script>xv.cats.write_thumb_block_list([
        {"i":"https://thumb-cdn77.xnxx-cdn.com/abc/0/xn_7_t.jpg","u":"/search/amateur?id=79921165","t":"Amateur","id":65,"ty":"cat"}
      ], "home-cat-list");</script>
    `;
    const entries = parseXnxxCategories(html, "https://www.xnxx.com/");
    const amateur = entries.find(entry => entry.id === "65");
    assert.ok(amateur);
    assert.equal(amateur.thumbnail, "https://thumb-cdn77.xnxx-cdn.com/abc/0/xn_7_t.jpg");
  });

  it("parses tag links from tags index HTML", () => {
    const html = `
      <a href="/search/a-girl-knows">a girl knows</a>
      <a href="/search/amateur">amateur</a>
    `;
    const entries = parseXnxxCategories(html, "https://www.xnxx.com/tags/a");
    assert.ok(entries.some(entry => entry.display_id === "a-girl-knows"));
    assert.ok(entries.some(entry => entry.display_id === "amateur"));
  });
});

describe("parseXnxxEntries", () => {
  it("parses video links from listing HTML", () => {
    const html = `
      <div class="mozaique">
        <div id="video_1bkzkdb2" class="thumb-block">
          <img data-mzl="https://thumb-cdn77.xnxx-cdn.com/abc/0/mozaique_listing.jpg" />
          <a href="/video-1bkzkdb2/beautiful_18_year_old" title="Beautiful 18 year old">Beautiful 18 year old</a>
        </div>
        <div id="video_qjwjvb4" class="thumb-block">
          <img data-src="https://thumb-cdn77.xnxx-cdn.com/def/0/xn_5_t.jpg" />
          <a href="/video-qjwjvb4/amateur_real_milff" title="amateur real milff">amateur real milff</a>
        </div>
      </div>
    `;
    const entries = parseXnxxEntries(html, "https://www.xnxx.com/search/amateur/");
    assert.equal(entries.length, 2);
    assert.equal(entries[0].id, "1bkzkdb2");
    assert.equal(entries[0].url, "https://www.xnxx.com/video-1bkzkdb2/beautiful_18_year_old");
    assert.equal(entries[0].title, "Beautiful 18 year old");
    assert.equal(entries[0].thumbnail, "https://thumb-cdn77.xnxx-cdn.com/abc/0/mozaique_listing.jpg");
    assert.equal(entries[1].thumbnail, "https://thumb-cdn77.xnxx-cdn.com/def/0/xn_5_t.jpg");
  });
});
