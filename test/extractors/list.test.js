"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveListExtractor,
  listListCapableExtractors,
} = require("../../lib/core/registry");
const { registerBuiltInExtractors } = require("../../lib/extractor/register");
const { listVideos } = require("../../lib/index");

registerBuiltInExtractors();

const LIST_CASES = [
  ["youporn", "https://www.youporn.com/porntags/milf/"],
  ["youporn-category", "https://www.youporn.com/category/amateur/"],
  ["youjizz", "https://www.youjizz.com/categories/teen-1.html"],
];

describe("video list API", () => {
  it("registers list-capable extractors", () => {
    const names = listListCapableExtractors().map(ie => ie.IE_NAME).sort();
    assert.deepEqual(names, ["youjizz", "youporn"]);
  });

  for (const [name, url] of LIST_CASES) {
    it(`${name} listUrlSupported matches fixture`, () => {
      const service = name.startsWith("youporn") ? "youporn" : name;
      const IE = resolveListExtractor(url, service);
      assert.ok(IE);
      assert.equal(IE.IE_NAME, service);
    });
  }

  it("rejects single-video URLs for listing", () => {
    assert.throws(
      () => resolveListExtractor("https://www.youporn.com/watch/16290308/", "youporn"),
      /not a supported listing page/,
    );
    assert.equal(resolveListExtractor("https://www.youporn.com/watch/16290308/"), null);
  });

  for (const [name, url] of LIST_CASES) {
    it(`${name} listVideos returns ids (live)`, { timeout: 30_000 }, async () => {
      const service = name.startsWith("youporn") ? "youporn" : name;
      const result = await listVideos(url, { service, limit: 5 });
      assert.equal(result.extractor, service);
      assert.ok(result.entries.length >= 1, "expected at least one entry");
      for (const entry of result.entries) {
        assert.match(entry.url, /^https?:\/\//);
        assert.match(entry.id, /^\d+$/);
        if (service === "youporn") assert.match(entry.url, /youporn\.com\/watch\//);
        if (service === "youjizz") assert.match(entry.url, /youjizz\.com\/videos\//);
      }
    });
  }
});
