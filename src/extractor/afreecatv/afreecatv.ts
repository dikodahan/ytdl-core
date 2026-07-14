import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import { baseInfo, hlsFormat, matchId, progressiveFormat } from "../_shared/helpers";

/** Keep IE_NAME=afreecatv; accept both sooplive and legacy afreecatv VOD hosts. */
const VALID_URL =
  /^https?:\/\/vod\.(?:sooplive|afreecatv)\.com\/(?:PLAYER\/STATION|player)\/(?<id>\d+)/i;

interface AfreecaFile {
  file?: string;
  file_info_key?: string;
  duration?: number;
}

interface AfreecaViewData {
  code?: number;
  title?: string;
  writer_nick?: string;
  bj_id?: string;
  total_file_duration?: number;
  thumb?: string;
  files?: AfreecaFile[];
  sub_upload_type?: string;
}

export class AfreecaTVIE extends InfoExtractor {
  static IE_NAME = "afreecatv";
  static IE_DESC = "AfreecaTV / Soop VOD";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — progressive + HLS from station/video/a/view`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const videoId = matchId(url, VALID_URL);
    const body = new URLSearchParams({
      nTitleNo: videoId,
      nApiLevel: "10",
    }).toString();

    const resp = await this.request.json<{ data?: AfreecaViewData }>(
      "https://api.m.sooplive.com/station/video/a/view",
      {
        method: "POST",
        headers: {
          Referer: url,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );

    const data = resp.data;
    if (!data) throw new Error(`afreecatv: empty API response for ${videoId}`);

    if (data.code === -6221) throw new Error("afreecatv: The VOD does not exist");
    if (data.code === -6205) throw new Error("afreecatv: This VOD is private (login may be required)");
    if (data.sub_upload_type) {
      throw new Error(
        "afreecatv: subscriber-only VOD requires authentication (CloudFront private auth not ported)",
      );
    }

    const formats: Format[] = [];
    for (const [i, file] of (data.files || []).entries()) {
      const fileUrl = file.file;
      if (!fileUrl) continue;
      const part = file.file_info_key || `${videoId}_${i + 1}`;
      if (/\.m3u8(?:\?|$)/i.test(fileUrl)) {
        formats.push(hlsFormat(fileUrl, `hls-${part}`));
      } else {
        formats.push(
          progressiveFormat(fileUrl, {
            format_id: `http-${part}`,
          }),
        );
      }
    }

    if (!formats.length) {
      throw new Error(`afreecatv: no playable formats for ${videoId} (may require login)`);
    }

    return baseInfo("afreecatv", url, {
      id: videoId,
      title: data.title || videoId,
      uploader: data.writer_nick || null,
      uploader_id: data.bj_id || null,
      duration: data.total_file_duration != null ? data.total_file_duration / 1000 : null,
      thumbnail: data.thumb,
      formats,
      http_headers: { Referer: url },
    });
  }
}
