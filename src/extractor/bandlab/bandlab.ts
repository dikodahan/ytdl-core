import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import { baseInfo, progressiveFormat } from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?:www\.)?bandlab\.com\/(?:(?<url_type>track|post|revision)\/(?<id>[\da-f_-]+)|(?<url_type2>embed)\/\?(?:[^#]*&)?id=(?<id2>[\da-f-]+))/i;

interface BandlabRevision {
  id?: string;
  revisionId?: string;
  description?: string;
  createdOn?: string;
  song?: { name?: string; picture?: { url?: string } };
  mixdown?: { file?: string; duration?: number };
  creator?: { name?: string; username?: string };
  counters?: { plays?: number; likes?: number; comments?: number };
}

interface BandlabPost {
  id?: string;
  type?: string;
  caption?: string;
  revisionId?: string;
  revision?: BandlabRevision;
  track?: {
    name?: string;
    sample?: { audioUrl?: string; duration?: number };
    picture?: { url?: string; original?: string };
  };
  video?: { url?: string; duration?: number; picture?: { url?: string } };
  creator?: { name?: string; username?: string };
  counters?: { plays?: number; likes?: number; comments?: number };
  createdOn?: string;
}

export class BandlabIE extends InfoExtractor {
  static IE_NAME = "bandlab";
  static IE_DESC = "BandLab tracks / posts / revisions";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — mixdown / sample audio`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  private async callApi<T>(endpoint: string, assetId: string, query?: Record<string, string>): Promise<T> {
    return this.request.json<T>(`https://www.bandlab.com/api/v1.3/${endpoint}/${assetId}`, {
      query,
      headers: {
        accept: "application/json",
        referer: "https://www.bandlab.com/",
        "x-client-id": "BandLab-Web",
        "x-client-version": "10.1.124",
      },
    });
  }

  async extract(url: string): Promise<InfoDict> {
    const m = url.match(VALID_URL);
    if (!m?.groups) throw new Error(`Could not extract id from URL: ${url}`);

    const displayId = m.groups.id || m.groups.id2;
    let urlType = m.groups.url_type || m.groups.url_type2;
    if (!displayId || !urlType) throw new Error(`Could not extract id from URL: ${url}`);

    const qs = new URL(url).searchParams;
    let revisionId = qs.get("revId") || qs.get("id") || null;
    if (urlType === "revision") revisionId = displayId;
    if (urlType === "embed") {
      revisionId = displayId;
      urlType = "revision";
    }

    let revisionData: BandlabRevision | null = null;
    let postData: BandlabPost | null = null;

    if (!revisionId) {
      const sharedKey = qs.get("sharedKey") || undefined;
      postData = await this.callApi<BandlabPost>("posts", displayId, sharedKey ? { sharedKey } : undefined);
      revisionId = postData.revisionId || postData.revision?.id || null;
      revisionData = postData.revision || null;

      if (!revisionData && !revisionId) {
        if (postData.type === "Video" && postData.video?.url) {
          return baseInfo("bandlab", url, {
            id: postData.id || displayId,
            title: (postData.caption || displayId).replace(/\n/g, " ").slice(0, 72),
            description: postData.caption || null,
            uploader: postData.creator?.name || null,
            uploader_id: postData.creator?.username || null,
            duration: postData.video.duration ?? null,
            thumbnail: postData.video.picture?.url,
            formats: [progressiveFormat(postData.video.url, { format_id: "http" })],
          });
        }
        if (postData.type === "Track" && postData.track?.sample?.audioUrl) {
          const audioUrl = postData.track.sample.audioUrl;
          return baseInfo("bandlab", url, {
            id: postData.revisionId || postData.id || displayId,
            title: postData.track.name || displayId,
            description: postData.caption || null,
            uploader: postData.creator?.name || null,
            uploader_id: postData.creator?.username || null,
            duration: postData.track.sample.duration ?? null,
            thumbnail: postData.track.picture?.original || postData.track.picture?.url,
            formats: [
              progressiveFormat(audioUrl, {
                format_id: "http",
                has_video: false,
                vcodec: "none",
              }),
            ],
          });
        }
        throw new Error(`Could not extract BandLab data for post type ${postData.type}`);
      }
    }

    if (!revisionData && revisionId) {
      revisionData = await this.callApi<BandlabRevision>("revisions", revisionId, { edit: "false" });
    }
    if (!revisionData) throw new Error(`No BandLab revision data for ${displayId}`);

    const mixdownUrl = revisionData.mixdown?.file;
    if (!mixdownUrl) throw new Error(`No mixdown file for BandLab revision ${revisionId || displayId}`);

    const formats: Format[] = [
      progressiveFormat(mixdownUrl, {
        format_id: "http",
        has_video: false,
        vcodec: "none",
      }),
    ];

    return baseInfo("bandlab", url, {
      id: revisionData.revisionId || revisionData.id || revisionId || displayId,
      title: revisionData.song?.name || displayId,
      description: revisionData.description || null,
      uploader: revisionData.creator?.name || null,
      uploader_id: revisionData.creator?.username || null,
      duration: revisionData.mixdown?.duration ?? null,
      thumbnail: revisionData.song?.picture?.url,
      formats,
    });
  }
}
