"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeAndroidApplicationName,
} = require("../../lib/extractor/kaltura-ott/discover");

describe("kaltura-ott discover app FQDN", () => {
  it("normalizes Android package names", () => {
    assert.equal(normalizeAndroidApplicationName("com.cellcom.cellcomtv"), "com.cellcom.cellcomtv");
    assert.equal(
      normalizeAndroidApplicationName("package:com.kaltura.reshet.atv"),
      "com.kaltura.reshet.atv",
    );
  });

  it("rejects websites and bare words", () => {
    assert.throws(() => normalizeAndroidApplicationName("https://tv.reshet.com"), /Invalid Android/);
    assert.throws(() => normalizeAndroidApplicationName("reshet"), /Invalid Android/);
    assert.throws(() => normalizeAndroidApplicationName(""), /required/);
  });
});
