import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { InfoDict } from "../../core/types";
import { baseInfo, hlsFormat, matchId } from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?:(?:(?:www|go|m)\.)?twitch\.tv\/(?:[^/]+\/v(?:ideo)?|videos)\/|player\.twitch\.tv\/\?.*?\bvideo=v?)(?<id>\d+)/i;

const CLIENT_IDS = [
  "kimne78kx3ncx6brgo4mv6wki5h1ko",
  "ue6666qo983tsx6so1t0vnawi233wa",
];

export class TwitchIE extends InfoExtractor {
  static IE_NAME = "twitch";
  static IE_DESC = "Twitch VODs";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — HLS via usher`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  private async gql<T>(
    clientId: string,
    ops: unknown,
  ): Promise<T> {
    return this.request.json<T>("https://gql.twitch.tv/gql", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
        "Client-ID": clientId,
      },
      body: JSON.stringify(ops),
    });
  }

  async extract(url: string): Promise<InfoDict> {
    const id = matchId(url, VALID_URL);
    let token: { value: string; signature: string } | null = null;
    let title = `Twitch VOD ${id}`;
    let uploader: string | null = null;
    let usedClient = CLIENT_IDS[0]!;

    const tokenQuery = {
      query: `{
        videoPlaybackAccessToken(
          id: "${id}",
          params: { platform: "web", playerBackend: "mediaplayer", playerType: "site" }
        ) { value signature }
      }`,
    };

    for (const clientId of CLIENT_IDS) {
      try {
        const res = await this.gql<{
          data?: { videoPlaybackAccessToken?: { value: string; signature: string } };
        }>(clientId, tokenQuery);
        const access = res.data?.videoPlaybackAccessToken;
        if (access?.value && access.signature) {
          token = access;
          usedClient = clientId;
          break;
        }
      } catch {
        /* try next client */
      }
    }

    if (!token) throw new Error(`Unable to obtain Twitch playback access token for ${id}`);

    try {
      type VideoMeta = {
        title?: string;
        owner?: { displayName?: string; login?: string };
      };
      const meta = await this.gql<Array<{ data?: { video?: VideoMeta } }> | { data?: { video?: VideoMeta } }>(
        usedClient,
        [
          {
            operationName: "VideoMetadata",
            variables: { channelLogin: "", videoID: id },
            extensions: {
              persistedQuery: {
                version: 1,
                sha256Hash: "300db574bd20200fc33c574b6ab48c5415e1894077692b1dba10df30a1d37324",
              },
            },
          },
        ],
      );
      const video = Array.isArray(meta) ? meta[0]?.data?.video : meta.data?.video;
      if (video?.title) title = video.title;
      uploader = video?.owner?.displayName || video?.owner?.login || null;
    } catch {
      /* metadata optional */
    }

    const usher = new URL(`https://usher.ttvnw.net/vod/${id}.m3u8`);
    usher.searchParams.set("allow_source", "true");
    usher.searchParams.set("allow_audio_only", "true");
    usher.searchParams.set("allow_spectre", "true");
    usher.searchParams.set("player", "twitchweb");
    usher.searchParams.set("playlist_include_framerate", "true");
    usher.searchParams.set("sig", token.signature);
    usher.searchParams.set("token", token.value);

    return baseInfo("twitch", url, {
      id: `v${id}`,
      title,
      uploader,
      formats: [hlsFormat(usher.toString(), "hls")],
      was_live: true,
    });
  }
}
