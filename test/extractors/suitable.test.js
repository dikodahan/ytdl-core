"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  listExtractors,
  findExtractorByName,
  resolveExtractor,
} = require("../../lib/core/registry");
const { registerBuiltInExtractors } = require("../../lib/extractor/register");

registerBuiltInExtractors();

const CASES = [
  ["youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
  ["jwplatform", "https://cdn.jwplayer.com/v2/media/nPripu9l"],
  ["bitmovin", "https://streams.bitmovin.com/cgl9rh94uvs51rqc8jhg/share"],
  ["cloudflarestream", "https://watch.cloudflarestream.com/31c9291ab41fac05471db4e73aa11717"],
  ["wistia", "https://fast.wistia.net/embed/iframe/j38ihh83m5"],
  ["brightcove", "https://players.brightcove.net/123/default_default/index.html?videoId=456"],
  ["kaltura", "kaltura:123:0_abc"],
  ["anvato", "anvato:lin:8032455"],
  ["theplatform", "https://link.theplatform.com/s/provider/media/id123"],
  ["bunnycdn", "https://iframe.mediadelivery.net/embed/123/abcdef01-2345-6789-abcd-ef0123456789"],
  ["voxmedia", "https://volume.vox-cdn.com/embed/abcdef012"],
  ["dailymotion", "https://www.dailymotion.com/video/x5kesuj"],
  ["soundcloud", "https://soundcloud.com/forss/flickermood"],
  ["reddit", "https://www.reddit.com/r/videos/comments/abc123/title/"],
  ["twitch", "https://www.twitch.tv/videos/1234567890"],
  ["vimeo", "https://vimeo.com/22439234"],
  ["bilibili", "https://www.bilibili.com/video/BV1xx411c7mD"],
  ["twitter", "https://x.com/user/status/1234567890123456789"],
  ["tiktok", "https://www.tiktok.com/@user/video/7123456789012345678"],
  ["instagram", "https://www.instagram.com/reel/AbCdEfGhIjK/"],
  ["facebook", "https://www.facebook.com/watch/?v=1234567890"],
  // Batch 2
  ["bandcamp", "https://relapsealumni.bandcamp.com/track/hail-to-fire"],
  ["rumble", "https://rumble.com/embed/v5pv5f"],
  ["kick", "https://kick.com/xqc/videos/5c697a87-afce-4256-b01f-3c8fe71ef5cb"],
  ["patreon", "https://www.patreon.com/posts/video-sketchbook-32452882"],
  ["bluesky", "https://bsky.app/profile/mary.my.id/post/3l6zrz6zyl2dr"],
  ["bitchute", "https://www.bitchute.com/video/UGlrF9o9b-Q/"],
  ["newgrounds", "https://www.newgrounds.com/portal/view/297383"],
  ["ninegag", "https://9gag.com/gag/ae5Ag7B"],
  ["coub", "https://coub.com/view/5u5n1"],
  ["peertube", "https://framatube.org/videos/watch/9c9de5e8-0a1e-484a-b099-e80766180a6d"],
  // Batch 3
  ["niconico", "https://www.nicovideo.jp/watch/sm8628149"],
  ["afreecatv", "https://vod.sooplive.com/player/192805325"],
  ["naver", "https://tv.naver.com/v/81652"],
  ["iqiyi", "http://www.iqiyi.com/v_19rrojlavg.html"],
  ["youku", "http://v.youku.com/v_show/id_XOTUxMzg4NDMy.html"],
  ["fc2", "https://video.fc2.com/content/20121209FP73fxDx"],
  ["weibo", "https://weibo.com/7827771738/N4xlMvjhI"],
  ["xiaohongshu", "https://www.xiaohongshu.com/explore/6411cf99000000001300b6d9"],
  ["vk", "https://vk.com/video205387401_165548505"],
  ["odnoklassniki", "https://ok.ru/video/20079905452"],
  // Batch 4
  ["audiomack", "https://www.audiomack.com/song/roosh-williams/extraordinary"],
  [
    "applepodcasts",
    "https://podcasts.apple.com/us/podcast/urbana-podcast-724-by-david-penn/id1531349107?i=1000748574256",
  ],
  ["mixcloud", "https://www.mixcloud.com/dholbach/cryptkeeper/"],
  ["soundgasm", "https://soundgasm.net/u/ytdl/Piano-sample"],
  ["acast", "https://shows.acast.com/sparpodcast/episodes/2.raggarmordet-rosterurdetforflutna"],
  [
    "art19",
    "https://art19.com/shows/scamfluencers/episodes/8319b776-4153-4d22-8630-631f204a03dd",
  ],
  ["yandexmusic", "https://music.yandex.ru/album/540508/track/4878838"],
  ["audius", "https://audius.co/voltra/radar-103692"],
  [
    "bandlab",
    "https://www.bandlab.com/track/04b37e88dba24967b9dac8eb8567ff39_07d7f906fc96ee11b75e000d3a428fff",
  ],
  ["reverbnation", "https://www.reverbnation.com/alkilados/song/16965047-mona-lisa"],
];

describe("extractor suitable()", () => {
  it("registers youtube + batches 0–4", () => {
    const names = listExtractors().map(ie => ie.IE_NAME).sort();
    assert.equal(names.length, 51);
    for (const [name] of CASES) {
      assert.ok(findExtractorByName(name), `missing ${name}`);
    }
  });

  for (const [name, url] of CASES) {
    it(`${name} matches fixture URL`, () => {
      const IE = findExtractorByName(name);
      assert.ok(IE);
      assert.equal(IE.suitable(url), true, url);
    });
  }

  it("force service rejects URL mismatch", () => {
    assert.throws(
      () => resolveExtractor("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "jwplatform"),
      /not valid for service/,
    );
  });

  it("force service selects named IE", () => {
    const IE = resolveExtractor("https://cdn.jwplayer.com/v2/media/nPripu9l", "jwplatform");
    assert.equal(IE.IE_NAME, "jwplatform");
  });
});
