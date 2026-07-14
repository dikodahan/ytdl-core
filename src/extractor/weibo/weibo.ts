import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  hlsFormat,
  matchId,
  progressiveFormat,
  tryParseJson,
} from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?:m\.weibo\.cn\/(?:status|detail)|(?:www\.)?weibo\.com\/\d+)\/(?<id>[a-zA-Z0-9]+)/i;

interface PlayInfo {
  url?: string;
  quality_desc?: string;
  label?: string;
  bitrate?: number;
  width?: number;
  height?: number;
  size?: number;
  video_codecs?: string;
  audio_codecs?: string;
  mime?: string;
}

interface MediaInfo {
  playback_list?: Array<{ play_info?: PlayInfo }>;
  video_title?: string;
  kol_title?: string;
  name?: string;
  duration?: number;
  video_publish_time?: number;
  online_users_number?: number;
  stream_url?: string;
  stream_url_hd?: string;
  mp4_hd_url?: string;
  mp4_sd_url?: string;
  [key: string]: unknown;
}

interface WeiboStatus {
  id?: string | number;
  id_str?: string;
  mid?: string;
  mblogid?: string;
  text_raw?: string;
  text?: string;
  page_info?: {
    media_info?: MediaInfo;
    page_pic?: string;
  };
  user?: {
    screen_name?: string;
    id?: string | number;
    id_str?: string;
  };
  attitudes_count?: number;
  mix_media_info?: {
    items?: Array<{
      type?: string;
      data?: { object_id?: string; media_info?: MediaInfo };
    }>;
  };
}

function stripJsonp(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  const a0 = text.indexOf("[");
  const a1 = text.lastIndexOf("]");
  if (a0 >= 0 && a1 > a0) return text.slice(a0, a1 + 1);
  return text;
}

export class WeiboIE extends InfoExtractor {
  static IE_NAME = "weibo";
  static IE_DESC = "微博 / Weibo";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — ajax/statuses/show media playback`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  private async updateVisitorCookies(): Promise<void> {
    const headers = { Referer: "https://weibo.com/" };
    const ua = this.request.defaultHeaders["User-Agent"] || "";
    const chromeVer = ua.match(/Chrome\/(\d+)/)?.[1] || "125";

    const genBody = await this.request.text(
      "https://passport.weibo.com/visitor/genvisitor",
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          cb: "gen_callback",
          fp: JSON.stringify({
            os: "1",
            browser: `Chrome${chromeVer},0,0,0`,
            fonts: "undefined",
            screenInfo: "1920*1080*24",
            plugins: "",
          }),
        }).toString(),
      },
    );

    const genJson = tryParseJson<{ data?: { tid?: string; new_tid?: boolean; confidence?: number } }>(
      stripJsonp(genBody),
    );
    const tid = genJson?.data?.tid;
    if (!tid) throw new Error("weibo: failed to generate guest visitor tid");

    await this.request.text("https://passport.weibo.com/visitor/visitor", {
      headers,
      query: {
        a: "incarnate",
        t: tid,
        w: genJson?.data?.new_tid ? 3 : 2,
        c: String(genJson?.data?.confidence ?? 100).padStart(3, "0"),
        gc: "",
        cb: "cross_domain",
        from: "weibo",
        _rand: Math.random(),
      },
    });
  }

  private async downloadStatusJson(videoId: string): Promise<WeiboStatus> {
    const headers = { Referer: "https://weibo.com/" };
    const fetchOnce = async () =>
      this.request.request("https://weibo.com/ajax/statuses/show", {
        headers,
        query: { id: videoId },
      });

    let res = await fetchOnce();
    let parsed = tryParseJson<WeiboStatus>(res.body);

    if (!parsed || /passport\.weibo\.com/i.test(res.body) || res.statusCode === 432) {
      await this.updateVisitorCookies();
      res = await fetchOnce();
      parsed = tryParseJson<WeiboStatus>(res.body);
    }

    if (!parsed) {
      throw new Error(
        `weibo: failed to load status ${videoId} (login/guest visitor cookies may be required)`,
      );
    }
    return parsed;
  }

  private formatsFromMedia(media?: MediaInfo): Format[] {
    if (!media) return [];
    const formats: Format[] = [];

    for (const item of media.playback_list || []) {
      const play = item.play_info;
      if (!play?.url) continue;
      const formatId = play.label || play.quality_desc || "http";
      if (/\.m3u8/i.test(play.url)) {
        formats.push({
          ...hlsFormat(play.url, formatId),
          width: play.width ?? null,
          height: play.height ?? null,
          tbr: play.bitrate ?? null,
          filesize: play.size ?? null,
          vcodec: play.video_codecs || "unknown",
          acodec: play.audio_codecs || "unknown",
        });
      } else {
        formats.push(
          progressiveFormat(play.url, {
            format_id: formatId,
            width: play.width ?? null,
            height: play.height ?? null,
            filesize: play.size ?? null,
            vcodec: play.video_codecs || "unknown",
            acodec: play.audio_codecs || "unknown",
          }),
        );
      }
    }

    if (!formats.length) {
      const fallbackKeys = ["stream_url_hd", "stream_url", "mp4_hd_url", "mp4_sd_url"] as const;
      for (const key of fallbackKeys) {
        const u = media[key];
        if (typeof u === "string" && /^https?:\/\//i.test(u)) {
          formats.push(
            /\.m3u8/i.test(u)
              ? hlsFormat(u, key)
              : progressiveFormat(u, { format_id: key }),
          );
        }
      }
    }

    return formats;
  }

  private parseVideoInfo(meta: WeiboStatus, pageUrl: string): InfoDict {
    const media = meta.page_info?.media_info;
    const formats = this.formatsFromMedia(media);
    if (!formats.length) {
      throw new Error(
        `weibo: no playable media_info urls for ${meta.id_str || meta.id || meta.mid}`,
      );
    }

    const id = String(meta.id_str || meta.id || meta.mid || "");
    const title =
      media?.video_title || media?.kol_title || media?.name || meta.text_raw || id;

    return baseInfo("weibo", pageUrl, {
      id,
      title: title.replace(/\n/g, " ").slice(0, 200),
      description: meta.text_raw || meta.text || null,
      duration: media?.duration ?? null,
      uploader: meta.user?.screen_name || null,
      uploader_id:
        meta.user?.id_str || (meta.user?.id != null ? String(meta.user.id) : null),
      thumbnail: meta.page_info?.page_pic,
      formats,
      http_headers: { Referer: "https://weibo.com/" },
    });
  }

  async extract(url: string): Promise<InfoDict> {
    const videoId = matchId(url, VALID_URL);
    const meta = await this.downloadStatusJson(videoId);

    const mixItems = meta.mix_media_info?.items?.filter(i => i.type !== "pic") || [];
    if (mixItems.length > 1) {
      // Prefer first video item for VLC single-info path
      const first = mixItems[0];
      const synthetic: WeiboStatus = {
        id: first.data?.object_id,
        id_str: first.data?.object_id,
        page_info: { media_info: first.data?.media_info },
        user: meta.user,
        text_raw: meta.text_raw,
      };
      return this.parseVideoInfo(synthetic, url);
    }

    if (mixItems.length === 1) {
      const item = mixItems[0];
      return this.parseVideoInfo(
        {
          id: item.data?.object_id || meta.id,
          id_str: item.data?.object_id || meta.id_str,
          page_info: { media_info: item.data?.media_info },
          user: meta.user,
          text_raw: meta.text_raw,
        },
        url,
      );
    }

    return this.parseVideoInfo(meta, url);
  }
}
