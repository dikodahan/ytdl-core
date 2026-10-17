"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { registerBuiltInExtractors } = require("../../lib/extractor/register");
const { resolveExtractor, resolveListExtractor } = require("../../lib/core/registry");
const {
  KalturaOttAuthenticationError,
  KalturaOttSubscriptionRequiredError,
  KalturaOttClient,
  decodePlayRequestUrl,
  parsePlayRequestParams,
  pickChannelLogo,
  pickStreamFormats,
} = require("../../lib/extractor/kaltura-ott/client");
const { KalturaOttIE } = require("../../lib/extractor/kaltura-ott/kaltura-ott");
const {
  mergePresetOverrides,
  resolvePartnerPreset,
} = require("../../lib/extractor/kaltura-ott/presets");
const { listVideos, extractInfo } = require("../../lib/index");

registerBuiltInExtractors();

describe("kaltura-ott presets", () => {
  it("resolves reshet and cellcom aliases", () => {
    assert.equal(resolvePartnerPreset("reshet")?.partnerId, 5031);
    assert.equal(resolvePartnerPreset("cellcom")?.partnerId, 3197);
    assert.equal(resolvePartnerPreset("5031")?.partnerId, 5031);
  });

  it("applies an Android app FQDN override", () => {
    const preset = resolvePartnerPreset("5031");
    const configured = mergePresetOverrides(preset, {
      applicationName: "com.kaltura.reshet.atv",
    });
    assert.equal(configured.deviceConfig.applicationName, "com.kaltura.reshet.atv");
    assert.equal(configured.partnerId, 5031);
  });

  it("forceAndroidTv switches Cellcom device platform to STB", () => {
    const preset = resolvePartnerPreset("cellcom");
    assert.equal(preset.deviceConfig.platform, "Android");
    const configured = mergePresetOverrides(preset, { forceAndroidTv: true });
    assert.equal(configured.deviceConfig.platform, "STB");
    assert.equal(configured.deviceConfig.applicationName, "com.cellcom.cellcomtv");
  });
});

describe("kaltura-ott helpers", () => {
  it("exposes password input metadata and safe authentication errors", () => {
    const password = KalturaOttIE.getInfo().options.find(option => option.key === "password");
    assert.equal(password?.type, "password");
    assert.doesNotMatch(new KalturaOttAuthenticationError().message, /secret|password123/i);
    assert.match(
      new KalturaOttSubscriptionRequiredError(false).message,
      /requires a subscription/i,
    );
  });

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

describe("cellcom authenticated playback (stubbed, fake credentials only)", () => {
  const playRequestUrl =
    "http://livetv-or.example:8080/ngx/78/srt_test/index.m3u8?smil_profile=default" +
    "&token=0123456789abcdef0123456789abcdef&expires=1792341694&ext_start_limit=1792255414";
  const playManifestUrl =
    "https://api.example/api_v3/service/assetFile/action/playManifest/partnerId/3197" +
    `/assetId/123/assetType/media/assetFileId/9/contextType/PLAYBACK/tokenizedUrl/${Buffer.from(playRequestUrl).toString("base64")}/ks/ks-for-device-1/a.m3u8`;
  const cdnUrl = "http://stm.example/_cat/test-jwt/ngx/78/srt_test/index.m3u8?smil_profile=fiber";

  function makeFakeRequest() {
    const calls = { logins: [], playbackKs: [] };
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const result = body => ({
      statusCode: 200,
      headers: {},
      body: typeof body === "string" ? body : JSON.stringify(body),
      json() {
        return typeof body === "string" ? JSON.parse(body) : body;
      },
    });
    return {
      calls,
      async request(url, options = {}) {
        if (url.includes("/action/login")) {
          const body = JSON.parse(options.body);
          calls.logins.push(body);
          return result({
            result: { loginSession: { ks: `ks-for-${body.udid}`, expiry } },
          });
        }
        if (url.includes("/playManifest/")) {
          return {
            statusCode: 200,
            headers: {},
            url: cdnUrl,
            body: "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nv.m3u8\n",
            json() {
              throw new Error("not json");
            },
          };
        }
        throw new Error(`unexpected request ${url}`);
      },
      async json(url, options = {}) {
        const body = options.body ? JSON.parse(options.body) : {};
        if (url.includes("configurations/action/serveByDevice")) return {};
        if (url.includes("householddevice/action/list")) {
          const preset = resolvePartnerPreset("cellcom");
          return {
            result: {
              objects: [
                { udid: preset.udid, name: "bootstrap", status: "ACTIVATED" },
                { udid: "device-1", name: "Fake Phone", status: "ACTIVATED" },
              ],
            },
          };
        }
        if (url.includes("asset/action/getPlaybackContext")) {
          calls.playbackKs.push(body.ks);
          if (body.ks !== "ks-for-device-1") {
            return { result: { error: { code: "1003", message: "Device not in household" } } };
          }
          return { result: { sources: [{ type: "HLS", url: playManifestUrl }] } };
        }
        if (url.includes("asset/action/get")) {
          return {
            result: {
              id: 123,
              name: "Test Channel",
              mediaFiles: [],
              metas: { ChannelNumber: { value: 7 } },
            },
          };
        }
        throw new Error(`unexpected json ${url}`);
      },
    };
  }

  it("decodes the livetv play request and its token parameters", () => {
    assert.equal(decodePlayRequestUrl(playManifestUrl), playRequestUrl);
    assert.deepEqual(parsePlayRequestParams(playRequestUrl), {
      token: "0123456789abcdef0123456789abcdef",
      expires: 1792341694,
      extStartLimit: 1792255414,
      smilProfile: "default",
    });
  });

  it("re-logs in as a registered household device for playback", async () => {
    const fake = makeFakeRequest();
    const preset = { ...resolvePartnerPreset("cellcom") };
    const client = new KalturaOttClient(fake, preset, {
      username: "fake-user",
      password: "fake-pass",
    });
    const session = await client.ensureSession();
    assert.equal(session.udid, "device-1");
    const sources = await client.getLivePlayback(123);
    assert.equal(sources[0].url, playManifestUrl);
    assert.ok(fake.calls.playbackKs.every(ks => ks === "ks-for-device-1"));
  });

  it("extracts the resolved playable stream link with per-request auth params", async () => {
    const { CellcomIE } = require("../../lib/extractor/cellcom/cellcom");
    const optionKeys = CellcomIE.getInfo().options.map(o => o.key);
    assert.ok(optionKeys.includes("username"));
    assert.ok(optionKeys.includes("password"));
    assert.ok(optionKeys.includes("deviceUdid"));

    const fake = makeFakeRequest();
    const ie = new CellcomIE(
      { extractorArgs: { username: "fake-user", password: "fake-pass" } },
      fake,
    );
    const info = await ie.extract("cellcom:live:123");
    assert.equal(info.extractor, "cellcom");
    const hls = info.formats.find(f => f.isHLS);
    assert.equal(hls.url, cdnUrl);
    assert.equal(hls.play_request_token, "0123456789abcdef0123456789abcdef");
    assert.equal(info.play_request_url, playRequestUrl);
    assert.equal(info.play_request_expires, 1792341694);
    // Auth params are used for login only and never leak into the result.
    assert.ok(fake.calls.logins.some(b => b.username === "fake-user"));
    assert.ok(!JSON.stringify(info).includes("fake-pass"));
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

describe("cellcom extractor routing", () => {
  it("exposes Force Android TV option metadata", () => {
    const { CellcomIE } = require("../../lib/extractor/cellcom/cellcom");
    const force = CellcomIE.getInfo().options.find(option => option.key === "forceAndroidTv");
    assert.equal(force?.type, "boolean");
    assert.equal(force?.default, false);
  });

  it("matches live extract and channel list URLs", () => {
    assert.ok(resolveExtractor("cellcom:live:803437", "cellcom"));
    assert.ok(resolveExtractor("cellcom:live:4559653", "cellcom"));
    assert.ok(resolveListExtractor("cellcom:channels", "cellcom"));
    assert.ok(resolveListExtractor("cellcom", "cellcom"));
    assert.throws(
      () => resolveExtractor("cellcom:channels", "cellcom"),
      /not valid for service/,
    );
  });

  it("lists channels with cellcom:live entry URLs", { timeout: 30_000 }, async () => {
    const result = await listVideos("cellcom:channels", { service: "cellcom", limit: 5 });
    assert.equal(result.extractor, "cellcom");
    assert.ok(result.entries.length >= 1);
    for (const entry of result.entries) {
      assert.match(entry.url, /^cellcom:live:\d+$/);
    }
  });

  it("extracts stream link for cellcom:live:4559653", { timeout: 45_000 }, async () => {
    const info = await extractInfo("cellcom:live:4559653", { service: "cellcom" });
    assert.equal(info.extractor, "cellcom");
    assert.equal(info.live_status, "is_live");
    assert.equal(info.id, "4559653");
    assert.ok(info.formats?.length >= 1);
    const hls = info.formats.find(f => f.isHLS || /\.m3u8/i.test(f.url));
    assert.ok(hls?.url, "expected HLS stream URL");
    assert.match(hls.url, /\.m3u8/i);
    assert.match(hls.url, /cellcom\.co\.il|kaltura\.com/i);
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

  it("falls back to Cellcom mediaFile HLS when playback context is NotEntitled", {
    timeout: 45_000,
  }, async () => {
    const info = await extractInfo("kaltura-ott:cellcom:live:4559653", {
      service: "kaltura-ott",
    });
    assert.equal(info.extractor, "kaltura-ott");
    assert.equal(info.id, "4559653");
    assert.ok(info.formats?.length >= 1);
    const hls = info.formats.find(f => f.isHLS || /\.m3u8/i.test(f.url));
    assert.ok(hls?.url);
    assert.match(hls.url, /livetv.*cellcom\.co\.il.*\.m3u8/i);
  });
});
