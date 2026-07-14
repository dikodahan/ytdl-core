import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  matchId,
  progressiveFormat,
  searchJsonAssignment,
  tryParseJson,
} from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?:www\.)?bilibili\.com\/video\/(?<prefix>[aAbB][vV])?(?<id>[^/?#&]+)/i;

const REFERER = "https://www.bilibili.com/";

interface PlayInfoData {
  durl?: Array<{ url?: string; size?: number; backup_url?: string[] }>;
  dash?: {
    video?: Array<{
      baseUrl?: string;
      base_url?: string;
      id?: number;
      bandwidth?: number;
      width?: number;
      height?: number;
      codecs?: string;
    }>;
    audio?: Array<{
      baseUrl?: string;
      base_url?: string;
      id?: number;
      bandwidth?: number;
      codecs?: string;
    }>;
  };
  timelength?: number;
}

export class BilibiliIE extends InfoExtractor {
  static IE_NAME = "bilibili";
  static IE_DESC = "Bilibili";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — progressive durl / DASH (A/V may be separate)`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  private formatsFromPlayInfo(data: PlayInfoData): Format[] {
    const formats: Format[] = [];

    for (const d of data.durl || []) {
      if (d.url) {
        formats.push(
          progressiveFormat(d.url, {
            format_id: "durl",
            filesize: d.size ?? null,
          }),
        );
      }
      for (const backup of d.backup_url || []) {
        formats.push(progressiveFormat(backup, { format_id: "durl-backup" }));
      }
    }

    for (const v of data.dash?.video || []) {
      const url = v.baseUrl || v.base_url;
      if (!url) continue;
      formats.push(
        progressiveFormat(url, {
          format_id: `dash-v-${v.id ?? "video"}`,
          width: v.width ?? null,
          height: v.height ?? null,
          tbr: v.bandwidth ? Math.round(v.bandwidth / 1000) : null,
          vcodec: v.codecs || "unknown",
          acodec: "none",
          has_audio: false,
          has_video: true,
          format_note: "video-only (merge with audio for VLC if needed)",
        }),
      );
    }

    for (const a of data.dash?.audio || []) {
      const url = a.baseUrl || a.base_url;
      if (!url) continue;
      formats.push(
        progressiveFormat(url, {
          format_id: `dash-a-${a.id ?? "audio"}`,
          tbr: a.bandwidth ? Math.round(a.bandwidth / 1000) : null,
          vcodec: "none",
          acodec: a.codecs || "unknown",
          has_audio: true,
          has_video: false,
          format_note: "audio-only",
        }),
      );
    }

    return formats;
  }

  async extract(url: string): Promise<InfoDict> {
    const rawId = matchId(url, VALID_URL);
    const m = url.match(VALID_URL);
    const prefix = (m?.groups?.prefix || (rawId.toUpperCase().startsWith("BV") ? "BV" : "av")).replace(
      /av/i,
      "av",
    );
    const isBv = /^bv/i.test(prefix + rawId) || /^BV/i.test(rawId);
    const videoId = isBv
      ? rawId.toUpperCase().startsWith("BV")
        ? rawId
        : `BV${rawId}`
      : rawId.replace(/^av/i, "");

    const pageUrl = isBv
      ? `https://www.bilibili.com/video/${videoId}`
      : `https://www.bilibili.com/video/av${videoId}`;

    const webpage = await this.request.text(pageUrl, {
      headers: { Referer: REFERER },
    });

    const initialState = searchJsonAssignment(
      webpage,
      /window\.__INITIAL_STATE__\s*=/,
    ) as {
      videoData?: {
        bvid?: string;
        aid?: number;
        title?: string;
        desc?: string;
        duration?: number;
        owner?: { name?: string; mid?: number };
        pic?: string;
        cid?: number;
        pages?: Array<{ cid?: number }>;
      };
    } | null;

    let playInfo = searchJsonAssignment(webpage, /window\.__playinfo__\s*=/) as {
      data?: PlayInfoData;
    } | null;

    const videoData = initialState?.videoData;
    const bvid = videoData?.bvid || (isBv ? videoId : undefined);
    const aid = videoData?.aid;
    const cid = videoData?.cid || videoData?.pages?.[0]?.cid;
    const id = bvid || (aid != null ? String(aid) : videoId);

    let data = playInfo?.data;
    if (!data?.durl && !data?.dash && cid) {
      const query: Record<string, string | number> = {
        cid,
        qn: 80,
        fnval: 4048,
        fourk: 1,
      };
      if (bvid) query.bvid = bvid;
      else if (aid) query.avid = aid;

      try {
        const api = await this.request.json<{ data?: PlayInfoData; message?: string }>(
          "https://api.bilibili.com/x/player/playurl",
          {
            query,
            headers: { Referer: REFERER },
          },
        );
        data = api.data;
      } catch {
        /* keep page playinfo */
      }
    }

    if (!data) {
      // last resort: parse playinfo from page text
      const mPlay = webpage.match(/window\.__playinfo__\s*=\s*(\{.+?\});/s);
      if (mPlay?.[1]) {
        const parsed = tryParseJson<{ data?: PlayInfoData }>(mPlay[1]);
        data = parsed?.data;
      }
    }

    if (!data) throw new Error(`Unable to get Bilibili playinfo for ${id}`);

    const formats = this.formatsFromPlayInfo(data);
    // Prefer returning both video + audio dash tracks (A/V may be separate; VLC may need merge)
    if (!formats.length) throw new Error(`No playable formats for Bilibili ${id}`);

    return baseInfo("bilibili", url, {
      id,
      title: videoData?.title || id,
      description: videoData?.desc || null,
      duration: videoData?.duration ?? (data.timelength ? data.timelength / 1000 : null),
      uploader: videoData?.owner?.name || null,
      uploader_id: videoData?.owner?.mid != null ? String(videoData.owner.mid) : null,
      thumbnail: videoData?.pic,
      formats,
      http_headers: { Referer: REFERER },
    });
  }
}
