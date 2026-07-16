"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { scrapePartnerCandidates } = require("../../lib/extractor/kaltura-ott/discover");

describe("kaltura-ott discover scrape", () => {
  it("finds partner id from ott host and image urls", () => {
    const sample = `
      fetch("https://5031.frp1.ott.kaltura.com/api_v3/service/ottuser/action/anonymousLogin", {
        body: JSON.stringify({ partnerId: 5031, udid: "abc" })
      });
      logo: https://images.frp1.ott.kaltura.com/Service.svc/GetImage/p/5031/entry_id/abc/version/0
      "idEqual": 360478
      applicationName: "com.kaltura.reshet.atv"
    `;
    const ids = scrapePartnerCandidates(sample);
    assert.ok(ids.includes(5031), `expected 5031 in ${ids.join(",")}`);
  });

  it("finds cellcom partner id from kSql snippet", () => {
    const sample = `"partnerId": "3197", "kSql": "(and customer_type_blacklist"`;
    const ids = scrapePartnerCandidates(sample);
    assert.ok(ids.includes(3197));
  });
});
