import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { InfoDict } from "../../core/types";
import { parseAmpFeed } from "../_shared/amp-feed";
import { baseInfo, matchId } from "../_shared/helpers";

const VIDEO_RE =
  /^https?:\/\/video\.(?:insider\.)?fox(?:news|business)\.com\/v\/(?:video-embed\.html\?video_id=)?(?<id>\d+)/i;

const WWW_VIDEO_RE = /^https?:\/\/(?:www\.)?foxnews\.com\/video\/(?<id>\d+)/i;

const ARTICLE_RE =
  /^https?:\/\/(?:www\.)?(?:insider\.)?foxnews\.com\/(?!v)(?:[^/?#]+\/)+(?<slug>[a-z0-9-]+)/i;

const EMBED_RE =
  /(?:https?:)?\/\/video\.foxnews\.com\/v\/(?:video-embed\.html|embed\.js)\?(?:[^>"']+&)?(?:video_)?id=(?<id>\d+)/i;

export class FoxNewsIE extends InfoExtractor {
  static IE_NAME = "foxnews";
  static IE_DESC = "Fox News and Fox Business Video";
  private static readonly _PATTERNS = [VIDEO_RE, WWW_VIDEO_RE, ARTICLE_RE];

  static suitable(url: string): boolean {
    return this._PATTERNS.some(re => re.test(url));
  }

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — HLS via Fox Akamai AMP API`,
      validUrl: [
        String(VIDEO_RE),
        String(WWW_VIDEO_RE),
        String(ARTICLE_RE),
      ].join(" | "),
      options: [],
    };
  }

  private async fetchAmpFeed(videoId: string) {
    const feedUrl = `https://api.foxnews.com/v3/video-player/${videoId}?callback=uid_${videoId}`;
    const raw = await this.request.text(feedUrl);
    return parseAmpFeed(raw, videoId);
  }

  private extractEmbedVideoId(webpage: string): string | null {
    const m = webpage.match(EMBED_RE);
    return m?.groups?.id || null;
  }

  async extract(url: string): Promise<InfoDict> {
    let videoId: string | null = null;
    let displayId: string | undefined;

    const videoMatch = url.match(VIDEO_RE);
    if (videoMatch?.groups?.id) {
      videoId = videoMatch.groups.id;
    }

    if (!videoId) {
      const wwwMatch = url.match(WWW_VIDEO_RE);
      if (wwwMatch?.groups?.id) videoId = wwwMatch.groups.id;
    }

    if (!videoId && ARTICLE_RE.test(url)) {
      displayId = matchId(url, ARTICLE_RE, "slug");
      const webpage = await this.request.text(url);
      const dataId = webpage.match(/data-video-id=(['"])(?<id>[^'"]+)\1/i)?.groups?.id;
      videoId = dataId || this.extractEmbedVideoId(webpage);
      if (!videoId) {
        throw new Error(`foxnews: no video id found on article ${displayId}`);
      }
    }

    if (!videoId) throw new Error(`Could not extract id from URL: ${url}`);

    const info = await this.fetchAmpFeed(videoId);
    return baseInfo("foxnews", url, {
      id: info.id,
      display_id: displayId,
      title: info.title,
      description: info.description,
      duration: info.duration,
      thumbnail: info.thumbnail || undefined,
      timestamp: info.timestamp,
      formats: info.formats,
    });
  }
}
