"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { parseYouPornCategories } = require("../../lib/extractor/_shared/page-links");

describe("parseYouPornCategories", () => {
  it("parses porntags and category links from homepage HTML", () => {
    const html = `
      <a class="button bubble-button bubble-porntag" href="/porntags/milf/">milf</a>
      <a class="button bubble-button bubble-porntag" href="/porntags/amateur-hotwife/">amateur hotwife</a>
      <a href="/category/creampie/" class="categoryBox tm_categoryBox">
        <img alt="Creampie" class="js_lazy">
      </a>
      <a class="menu_elem_text" href="/category/milf/" role="menuitem">Milf</a>
    `;
    const entries = parseYouPornCategories(html, "https://www.youporn.com/");
    const milf = entries.find((entry) => entry.id === "milf");
    assert.ok(milf);
    assert.equal(milf.url, "https://www.youporn.com/porntags/milf/");
    assert.equal(milf.title, "milf");
    assert.ok(entries.some((entry) => entry.id === "amateur-hotwife"));
    assert.ok(entries.some((entry) => entry.id === "creampie"));
  });
});
