"use strict";

/**
 * Live network smoke tests. Run with:
 *   YTDL_LIVE_TEST=1 node --test test/extractors/smoke-live.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { extractInfo } = require("../../lib/core/youtube-dl");

const enabled = process.env.YTDL_LIVE_TEST === "1";

const LIVE = [
  {
    service: "jwplatform",
    url: "https://cdn.jwplayer.com/v2/media/nPripu9l",
  },
  {
    service: "bitmovin",
    url: "https://streams.bitmovin.com/cgl9rh94uvs51rqc8jhg/share",
  },
  {
    service: "cloudflarestream",
    url: "https://watch.cloudflarestream.com/31c9291ab41fac05471db4e73aa11717",
  },
  {
    service: "dailymotion",
    url: "https://www.dailymotion.com/video/x5kesuj",
  },
  {
    service: "soundcloud",
    url: "https://soundcloud.com/forss/flickermood",
  },
  // Batch 2
  {
    service: "bandcamp",
    url: "https://relapsealumni.bandcamp.com/track/hail-to-fire",
  },
  {
    service: "coub",
    url: "https://coub.com/view/5u5n1",
  },
  {
    service: "peertube",
    url: "https://framatube.org/videos/watch/9c9de5e8-0a1e-484a-b099-e80766180a6d",
  },
  {
    service: "rumble",
    url: "https://rumble.com/embed/v5pv5f",
  },
  {
    service: "bluesky",
    url: "https://bsky.app/profile/mary.my.id/post/3l6zrz6zyl2dr",
  },
  {
    service: "ninegag",
    url: "https://9gag.com/gag/ae5Ag7B",
  },
  // Batch 3
  {
    service: "fc2",
    url: "https://video.fc2.com/content/20121209FP73fxDx",
  },
  {
    service: "odnoklassniki",
    url: "https://ok.ru/video/20079905452",
  },
  {
    service: "niconico",
    url: "https://www.nicovideo.jp/watch/sm8628149",
  },
  // Batch 4
  {
    service: "soundgasm",
    url: "https://soundgasm.net/u/ytdl/Piano-sample",
  },
  {
    service: "reverbnation",
    url: "https://www.reverbnation.com/alkilados/song/16965047-mona-lisa",
  },
  {
    service: "art19",
    url: "https://rss.art19.com/episodes/5ba1413c-48b8-472b-9cc3-cfd952340bdb.mp3",
  },
  {
    service: "acast",
    url: "https://shows.acast.com/sparpodcast/episodes/2.raggarmordet-rosterurdetforflutna",
  },
];

describe("live extract smoke", { skip: !enabled }, () => {
  for (const fixture of LIVE) {
    it(`${fixture.service} returns playable URL`, async () => {
      const info = await extractInfo(fixture.url, { service: fixture.service, quiet: true });
      assert.equal(info.extractor, fixture.service);
      assert.ok(info.id);
      assert.ok(Array.isArray(info.formats) && info.formats.length > 0);
      const playable = info.formats.find(f => f.url || f.manifest_url);
      assert.ok(playable, "expected at least one format URL");
    });
  }
});
