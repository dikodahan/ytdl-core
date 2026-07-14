import { InfoExtractor } from "../../core/info-extractor";
import type { InfoDict } from "../../core/types";
import { baseInfo, dashFormat, hlsFormat } from "../_shared/helpers";

const SUBDOMAIN = "(?:(?:watch|iframe|customer-\\w+)\\.)?";
const DOMAIN = "(?:cloudflarestream\\.com|(?:videodelivery|bytehighway)\\.net)";
const EMBED = `(?:embed\\.|${SUBDOMAIN})${DOMAIN}/embed/[^/?#]+\\.js\\?(?:[^#]+&)?video=`;
const ID = "[\\da-f]{32}|eyJ[\\w-]+\\.[\\w-]+\\.[\\w-]+";

export class CloudflareStreamIE extends InfoExtractor {
  static IE_NAME = "cloudflarestream";
  static IE_DESC = "Cloudflare Stream / video delivery embeds";
  static readonly _VALID_URL = new RegExp(
    `https?://(?:${SUBDOMAIN}(?<domain>${DOMAIN})/|${EMBED})(?<id>${ID})`,
    "i",
  );

  async extract(url: string): Promise<InfoDict> {
    const m = url.match(CloudflareStreamIE._VALID_URL);
    if (!m?.groups?.id) throw new Error(`Could not extract id from URL: ${url}`);

    let videoId = m.groups.id;
    let domain = m.groups.domain || "cloudflarestream.com";
    if (domain !== "bytehighway.net") domain = "cloudflarestream.com";

    // JWT signed playback tokens encode the media id in `sub`
    if (videoId.includes(".")) {
      const payload = videoId.split(".")[1] || "";
      const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
      const json = JSON.parse(Buffer.from(padded, "base64url").toString("utf8")) as {
        sub?: string;
      };
      if (!json.sub) throw new Error("Cloudflare Stream JWT missing sub claim");
      videoId = json.sub;
    }

    const base = `https://${domain}/${m.groups.id}/`;
    const manifestBase = `${base}manifest/video.`;

    return baseInfo(CloudflareStreamIE.IE_NAME, url, {
      id: videoId,
      title: videoId,
      thumbnail: `${base}thumbnails/thumbnail.jpg`,
      formats: [hlsFormat(`${manifestBase}m3u8`), dashFormat(`${manifestBase}mpd`)],
    });
  }
}
