import { Cookie } from "tough-cookie";
import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import { baseInfo, hlsFormat, matchId } from "../_shared/helpers";

const VALID_URL =
  /^(?:https?:\/\/(?:(?:v|play(?:er)?)\.(?:youku|tudou)\.com\/(?:v_show\/id_|player\.php\/sid\/)|video\.tudou\.com\/v\/)|youku:)(?<id>[A-Za-z0-9]+)(?:\.html|\/v\.swf)?/i;

function getYsuid(): string {
  const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let suffix = "";
  for (let i = 0; i < 3; i++) suffix += letters[Math.floor(Math.random() * letters.length)];
  return `${Math.floor(Date.now() / 1000)}${suffix}`;
}

function formatName(fm?: string): string {
  const map: Record<string, string> = {
    "3gp": "h6",
    "3gphd": "h5",
    flv: "h4",
    flvhd: "h4",
    mp4: "h3",
    mp4hd: "h3",
    mp4hd2: "h4",
    mp4hd3: "h4",
    hd2: "h2",
    hd3: "h1",
  };
  return (fm && map[fm]) || fm || "hls";
}

interface YoukuStream {
  m3u8_url?: string;
  stream_type?: string;
  channel_type?: string;
  size?: number | string;
  width?: number;
  height?: number;
}

interface YoukuUpsData {
  error?: { note?: string; code?: number };
  video?: {
    title?: string;
    seconds?: number;
    logo?: string;
    username?: string;
    userid?: string | number;
    tags?: string[];
  };
  stream?: YoukuStream[];
  uploader?: { homepage?: string };
}

export class YoukuIE extends InfoExtractor {
  static IE_NAME = "youku";
  static IE_DESC = "优酷 / Youku";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — ups/get.json HLS streams`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  private setCookie(name: string, value: string): void {
    this.request.agent.jar.setCookieSync(
      new Cookie({
        key: name,
        value,
        domain: "youku.com",
        path: "/",
        secure: false,
        httpOnly: false,
      }),
      "https://www.youku.com/",
    );
  }

  async extract(url: string): Promise<InfoDict> {
    const videoId = matchId(url, VALID_URL);

    this.setCookie("__ysuid", getYsuid());
    this.setCookie("xreferrer", "http://www.youku.com");

    const eg = await this.request.request("https://log.mmstat.com/eg.js");
    const etagRaw = eg.headers.etag || eg.headers.ETag;
    const etag = Array.isArray(etagRaw) ? etagRaw[0] : etagRaw;
    if (!etag) throw new Error("youku: failed to retrieve CNA from log.mmstat.com ETag");
    const cna = String(etag).replace(/^"|"$/g, "");

    const resp = await this.request.json<{ data?: YoukuUpsData }>(
      "https://ups.youku.com/ups/get.json",
      {
        query: {
          vid: videoId,
          ccode: "0564",
          client_ip: "192.168.1.1",
          utid: cna,
          client_ts: Date.now() / 1000,
        },
        headers: { Referer: url.startsWith("http") ? url : `https://v.youku.com/v_show/id_${videoId}.html` },
      },
    );

    const data = resp.data;
    if (!data) throw new Error(`youku: empty ups response for ${videoId}`);

    const error = data.error;
    if (error) {
      const note = error.note || "";
      if (note.includes("因版权原因无法观看此视频")) {
        throw new Error("youku: geo-restricted to China (copyright)");
      }
      if (note.includes("该视频被设为私密")) {
        throw new Error("youku: this video is private");
      }
      throw new Error(
        `youku: server error ${error.code ?? ""}${note ? `: ${note.replace(/<[^>]+>/g, "")}` : ""}`,
      );
    }

    const formats: Format[] = [];
    for (const stream of data.stream || []) {
      if (stream.channel_type === "tail" || !stream.m3u8_url) continue;
      formats.push({
        ...hlsFormat(stream.m3u8_url, formatName(stream.stream_type)),
        width: stream.width ?? null,
        height: stream.height ?? null,
        filesize: stream.size != null ? Number(stream.size) || null : null,
      });
    }

    if (!formats.length) throw new Error(`youku: no m3u8 streams for ${videoId}`);

    const video = data.video || {};
    return baseInfo("youku", url, {
      id: videoId,
      title: video.title || videoId,
      duration: video.seconds ?? null,
      thumbnail: video.logo,
      uploader: video.username || null,
      uploader_id: video.userid != null ? String(video.userid) : null,
      formats,
      http_headers: { Referer: "https://v.youku.com/" },
    });
  }
}
