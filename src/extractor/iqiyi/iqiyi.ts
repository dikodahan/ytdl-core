import { createHash } from "crypto";
import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import { baseInfo, hlsFormat, tryParseJson } from "../_shared/helpers";

const VALID_URL = /^https?:\/\/(?:(?:[^.]+\.)?iqiyi\.com|www\.pps\.tv)\/.+\.html/i;

const SIGN_KEY = "d5fb4bd9d50c4be6948c97edd7254b0e";

function md5Text(text: string): string {
  return createHash("md5").update(text).digest("hex");
}

interface IqiyiStream {
  m3utx?: string;
  vd?: number | string;
}

interface IqiyiTmtsData {
  code?: string;
  data?: {
    vidl?: IqiyiStream[];
  };
}

export class IqiyiIE extends InfoExtractor {
  static IE_NAME = "iqiyi";
  static IE_DESC = "爱奇艺 / iQIYI";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — tmts HLS (md5-signed sc)`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  private async getRawData(tvid: string, videoId: string): Promise<IqiyiTmtsData> {
    const tm = Date.now();
    const sc = md5Text(`${tm}${SIGN_KEY}${tvid}`);
    const body = await this.request.text(`http://cache.m.iqiyi.com/jp/tmts/${tvid}/${videoId}/`, {
      query: {
        tvid,
        vid: videoId,
        src: "76f90cbd92f94a2e925d83e8ccd22cb7",
        sc,
        t: tm,
      },
    });
    const jsonText = body.replace(/^var\s+tvInfoJs\s*=\s*/, "").trim();
    const parsed = tryParseJson<IqiyiTmtsData>(jsonText);
    if (!parsed) throw new Error("iqiyi: failed to parse tmts response");
    return parsed;
  }

  async extract(url: string): Promise<InfoDict> {
    const webpage = await this.request.text(url);

    const tvid =
      webpage.match(/data-(?:player|shareplattrigger)-tvid\s*=\s*['"](\d+)/i)?.[1] ||
      webpage.match(/["']tvid["']\s*[:=]\s*['"]?(\d+)/i)?.[1];
    const videoId =
      webpage.match(/data-(?:player|shareplattrigger)-videoid\s*=\s*['"]([a-f\d]+)/i)?.[1] ||
      webpage.match(/["']videoid["']\s*[:=]\s*['"]([a-f\d]+)/i)?.[1];

    if (!tvid || !videoId) {
      throw new Error("iqiyi: could not find tvid/videoid on page (album playlists not supported)");
    }

    let formats: Format[] = [];
    let lastCode = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const raw = await this.getRawData(tvid, videoId);
      lastCode = raw.code || "";
      if (raw.code !== "A00000") {
        if (raw.code === "A00111") throw new Error("iqiyi: geo-restricted");
        if (attempt < 4) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        throw new Error(`iqiyi: unable to load data. Error code: ${raw.code}`);
      }

      formats = [];
      for (const stream of raw.data?.vidl || []) {
        if (!stream.m3utx) continue;
        formats.push(hlsFormat(stream.m3utx, String(stream.vd ?? "hls")));
      }
      if (formats.length) break;
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!formats.length) {
      throw new Error(
        `iqiyi: no HLS formats for ${videoId}${lastCode ? ` (last code ${lastCode})` : ""} — may need login/VIP`,
      );
    }

    const title =
      webpage.match(/id=["']widget-videotitle["'][^>]*>([^<]+)/i)?.[1]?.trim() ||
      webpage.match(/property=["']og:title["']\s+content=["']([^"']+)/i)?.[1] ||
      webpage.match(/<title>([^<]+)/i)?.[1]?.replace(/\s*[-|_].*$/, "").trim() ||
      videoId;

    return baseInfo("iqiyi", url, {
      id: videoId,
      title,
      formats,
    });
  }
}
