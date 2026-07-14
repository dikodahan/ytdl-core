import { createHmac } from "crypto";
import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import { baseInfo, hlsFormat, matchId, progressiveFormat } from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?:m\.)?tv(?:cast)?\.naver\.com\/(?:v|embed)\/(?<id>\d+)/i;

const HMAC_KEY = Buffer.from(
  "nbxvs5nwNG9QKEWK0ADjYA4JZoujF4gHcIwvoCxFTPAeamq5eemvt5IWAYXxrbYM",
);

interface NaverStream {
  source?: string;
  type?: string;
  size?: number;
  encodingOption?: { name?: string; id?: string | number; width?: number; height?: number };
  bitrate?: { video?: number; audio?: number };
}

interface NaverStreamSet {
  type?: string;
  source?: string;
  keys?: Array<{ name?: string; value?: string }>;
  videos?: NaverStream[];
}

interface NaverPlayData {
  meta?: {
    subject?: string;
    count?: number;
    cover?: { source?: string };
    user?: { id?: string; name?: string; url?: string };
  };
  videos?: { list?: NaverStream[] };
  streams?: NaverStreamSet[];
}

interface NaverPlayInfo {
  clip?: {
    videoId?: string;
    title?: string;
    description?: string;
    playTime?: number;
    thumbnailImageUrl?: string;
    channelName?: string;
    channelId?: string;
    adultVideo?: boolean;
  };
  play?: { inKey?: string };
}

export class NaverIE extends InfoExtractor {
  static IE_NAME = "naver";
  static IE_DESC = "Naver TV";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — play-info HMAC + rmcnmv progressive/HLS`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  private async callPlayInfoApi(videoId: string): Promise<NaverPlayInfo> {
    const path = `/clips/${videoId}/play-info`;
    const apiEndpoint = `https://apis.naver.com/now_web2/now_web_api/v1${path}`;
    const msgpad = Date.now();
    const md = createHmac("sha1", HMAC_KEY)
      .update(`${apiEndpoint.slice(0, 255)}${msgpad}`)
      .digest("base64");

    const resp = await this.request.json<{ result?: NaverPlayInfo; message?: string }>(
      apiEndpoint,
      { query: { msgpad, md } },
    );
    if (!resp.result) {
      throw new Error(`naver: play-info failed${resp.message ? `: ${resp.message}` : ""}`);
    }
    return resp.result;
  }

  private formatsFromPlay(videoData: NaverPlayData): Format[] {
    const formats: Format[] = [];

    const pushStreams = (streams: NaverStream[], streamType: string, query: Record<string, string> = {}) => {
      for (const stream of streams) {
        let streamUrl = stream.source;
        if (!streamUrl) continue;
        if (Object.keys(query).length) {
          const u = new URL(streamUrl);
          for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
          streamUrl = u.toString();
        }
        const enc = stream.encodingOption || {};
        const formatId = `${stream.type || streamType}_${enc.name || enc.id || "default"}`;
        if (streamType === "HLS" || /\.m3u8/i.test(streamUrl)) {
          formats.push({
            ...hlsFormat(streamUrl, formatId),
            width: enc.width ?? null,
            height: enc.height ?? null,
            tbr: stream.bitrate?.video ?? null,
            filesize: stream.size ?? null,
          });
        } else {
          formats.push(
            progressiveFormat(streamUrl, {
              format_id: formatId,
              width: enc.width ?? null,
              height: enc.height ?? null,
              filesize: stream.size ?? null,
            }),
          );
        }
      }
    };

    pushStreams(videoData.videos?.list || [], "H264");

    for (const streamSet of videoData.streams || []) {
      const query: Record<string, string> = {};
      for (const param of streamSet.keys || []) {
        if (param.name && param.value != null) query[param.name] = param.value;
      }
      const streamType = streamSet.type || "stream";
      if (streamSet.videos?.length) {
        pushStreams(streamSet.videos, streamType, query);
      } else if (streamType === "HLS" && streamSet.source) {
        let streamUrl = streamSet.source;
        if (Object.keys(query).length) {
          const u = new URL(streamUrl);
          for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
          streamUrl = u.toString();
        }
        formats.push(hlsFormat(streamUrl, streamType));
      }
    }

    return formats;
  }

  async extract(url: string): Promise<InfoDict> {
    const videoId = matchId(url, VALID_URL);

    let vid: string | undefined;
    let inKey: string | undefined;
    let clip = undefined as NaverPlayInfo["clip"];

    try {
      const data = await this.callPlayInfoApi(videoId);
      clip = data.clip;
      vid = data.clip?.videoId;
      inKey = data.play?.inKey;
    } catch {
      /* fall through to page scrape */
    }

    if (!vid || !inKey) {
      const webpage = await this.request.text(url);
      vid =
        webpage.match(/["']?videoId["']?\s*[:=]\s*["']([^"']+)["']/)?.[1] ||
        webpage.match(/["']vid["']\s*[:=]\s*["']([^"']+)["']/)?.[1];
      inKey =
        webpage.match(/["']?inKey["']?\s*[:=]\s*["']([^"']+)["']/)?.[1] ||
        webpage.match(/["']inkey["']\s*[:=]\s*["']([^"']+)["']/i)?.[1];
    }

    if (!vid || !inKey) {
      throw new Error(
        `naver: unable to extract video id / inKey for ${videoId} (geo or login may be required)`,
      );
    }

    const videoData = await this.request.json<NaverPlayData>(
      `http://play.rmcnmv.naver.com/vod/play/v2.0/${vid}`,
      { query: { key: inKey } },
    );

    const formats = this.formatsFromPlay(videoData);
    if (!formats.length) throw new Error(`naver: no playable formats for ${videoId}`);

    const meta = videoData.meta;
    return baseInfo("naver", url, {
      id: videoId,
      title: clip?.title || meta?.subject || videoId,
      description: clip?.description || null,
      duration: clip?.playTime ?? null,
      uploader: clip?.channelName || meta?.user?.name || null,
      uploader_id: clip?.channelId || meta?.user?.id || null,
      thumbnail: clip?.thumbnailImageUrl || meta?.cover?.source,
      formats,
    });
  }
}
