import { registerExtractor } from "../core/registry";
import { YoutubeIE } from "./youtube/video";

// Batch 0 — embed / CDN platforms
import { BrightcoveIE } from "./brightcove";
import { JWPlatformIE } from "./jwplatform";
import { WistiaIE } from "./wistia";
import { KalturaIE } from "./kaltura";
import { AnvatoIE } from "./anvato";
import { ThePlatformIE } from "./theplatform";
import { CloudflareStreamIE } from "./cloudflarestream";
import { BunnyCdnIE } from "./bunnycdn";
import { BitmovinIE } from "./bitmovin";
import { VoxMediaIE } from "./voxmedia";

// Batch 1 — global platforms
import { VimeoIE } from "./vimeo";
import { TwitchIE } from "./twitch";
import { TiktokIE } from "./tiktok";
import { TwitterIE } from "./twitter";
import { InstagramIE } from "./instagram";
import { FacebookIE } from "./facebook";
import { RedditIE } from "./reddit";
import { SoundcloudIE } from "./soundcloud";
import { DailymotionIE } from "./dailymotion";
import { BilibiliIE } from "./bilibili";

// Batch 2 — VLC-oriented sites
import { BandcampIE } from "./bandcamp";
import { RumbleIE } from "./rumble";
import { KickIE } from "./kick";
import { PatreonIE } from "./patreon";
import { BlueskyIE } from "./bluesky";
import { BitchuteIE } from "./bitchute";
import { NewgroundsIE } from "./newgrounds";
import { NinegagIE } from "./ninegag";
import { CoubIE } from "./coub";
import { PeertubeIE } from "./peertube";

// Batch 3 — regional APIs
import { NiconicoIE } from "./niconico";
import { AfreecaTVIE } from "./afreecatv";
import { NaverIE } from "./naver";
import { IqiyiIE } from "./iqiyi";
import { YoukuIE } from "./youku";
import { FC2IE } from "./fc2";
import { WeiboIE } from "./weibo";
import { XiaoHongShuIE } from "./xiaohongshu";
import { VKIE } from "./vk";
import { OdnoklassnikiIE } from "./odnoklassniki";

// Batch 4 — audio / podcasts
import { AudiomackIE } from "./audiomack";
import { ApplePodcastsIE } from "./applepodcasts";
import { MixcloudIE } from "./mixcloud";
import { SoundgasmIE } from "./soundgasm";
import { AcastIE } from "./acast";
import { Art19IE } from "./art19";
import { YandexMusicIE } from "./yandexmusic";
import { AudiusIE } from "./audius";
import { BandlabIE } from "./bandlab";
import { ReverbNationIE } from "./reverbnation";

let registered = false;

export function registerBuiltInExtractors(): void {
  if (registered) return;
  registered = true;

  registerExtractor(YoutubeIE);

  // Batch 0 — embed / CDN platforms
  registerExtractor(BrightcoveIE);
  registerExtractor(JWPlatformIE);
  registerExtractor(WistiaIE);
  registerExtractor(KalturaIE);
  registerExtractor(AnvatoIE);
  registerExtractor(ThePlatformIE);
  registerExtractor(CloudflareStreamIE);
  registerExtractor(BunnyCdnIE);
  registerExtractor(BitmovinIE);
  registerExtractor(VoxMediaIE);

  // Batch 1 — global platforms
  registerExtractor(VimeoIE);
  registerExtractor(TwitchIE);
  registerExtractor(TiktokIE);
  registerExtractor(TwitterIE);
  registerExtractor(InstagramIE);
  registerExtractor(FacebookIE);
  registerExtractor(RedditIE);
  registerExtractor(SoundcloudIE);
  registerExtractor(DailymotionIE);
  registerExtractor(BilibiliIE);

  // Batch 2 — VLC-oriented sites
  registerExtractor(BandcampIE);
  registerExtractor(RumbleIE);
  registerExtractor(KickIE);
  registerExtractor(PatreonIE);
  registerExtractor(BlueskyIE);
  registerExtractor(BitchuteIE);
  registerExtractor(NewgroundsIE);
  registerExtractor(NinegagIE);
  registerExtractor(CoubIE);
  registerExtractor(PeertubeIE);

  // Batch 3 — regional APIs
  registerExtractor(NiconicoIE);
  registerExtractor(AfreecaTVIE);
  registerExtractor(NaverIE);
  registerExtractor(IqiyiIE);
  registerExtractor(YoukuIE);
  registerExtractor(FC2IE);
  registerExtractor(WeiboIE);
  registerExtractor(XiaoHongShuIE);
  registerExtractor(VKIE);
  registerExtractor(OdnoklassnikiIE);

  // Batch 4 — audio / podcasts
  registerExtractor(AudiomackIE);
  registerExtractor(ApplePodcastsIE);
  registerExtractor(MixcloudIE);
  registerExtractor(SoundgasmIE);
  registerExtractor(AcastIE);
  registerExtractor(Art19IE);
  registerExtractor(YandexMusicIE);
  registerExtractor(AudiusIE);
  registerExtractor(BandlabIE);
  registerExtractor(ReverbNationIE);
}

export { YoutubeIE };
export {
  BrightcoveIE,
  JWPlatformIE,
  WistiaIE,
  KalturaIE,
  AnvatoIE,
  ThePlatformIE,
  CloudflareStreamIE,
  BunnyCdnIE,
  BitmovinIE,
  VoxMediaIE,
};
export {
  VimeoIE,
  TwitchIE,
  TiktokIE,
  TwitterIE,
  InstagramIE,
  FacebookIE,
  RedditIE,
  SoundcloudIE,
  DailymotionIE,
  BilibiliIE,
};
export {
  BandcampIE,
  RumbleIE,
  KickIE,
  PatreonIE,
  BlueskyIE,
  BitchuteIE,
  NewgroundsIE,
  NinegagIE,
  CoubIE,
  PeertubeIE,
};
export {
  NiconicoIE,
  AfreecaTVIE,
  NaverIE,
  IqiyiIE,
  YoukuIE,
  FC2IE,
  WeiboIE,
  XiaoHongShuIE,
  VKIE,
  OdnoklassnikiIE,
};
export {
  AudiomackIE,
  ApplePodcastsIE,
  MixcloudIE,
  SoundgasmIE,
  AcastIE,
  Art19IE,
  YandexMusicIE,
  AudiusIE,
  BandlabIE,
  ReverbNationIE,
};
