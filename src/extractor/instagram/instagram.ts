import { InfoExtractor, type ExtractorInfo } from "../../core/info-extractor";
import type { Format, InfoDict } from "../../core/types";
import {
  baseInfo,
  extractBetween,
  extractJsonObject,
  matchId,
  progressiveFormat,
  tryParseJson,
} from "../_shared/helpers";

const VALID_URL =
  /^https?:\/\/(?:www\.)?instagram\.com\/(?:[^/?#]+\/)?(?:p|tv|reels?)\/(?<id>[^/?#&]+)/i;

function sessionRequired(): Error {
  return new Error(
    "Instagram requires a logged-in session for this content. " +
      "Pass cookies via `agent` (createAgent with Instagram session cookies) and retry.",
  );
}

function collectVideoUrls(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) collectVideoUrls(item, out);
    return out;
  }
  const obj = node as Record<string, unknown>;
  if (typeof obj.video_url === "string") out.push(obj.video_url);
  if (Array.isArray(obj.video_versions)) {
    for (const v of obj.video_versions as Array<{ url?: string }>) {
      if (v?.url) out.push(v.url);
    }
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") collectVideoUrls(v, out);
  }
  return out;
}

export class InstagramIE extends InfoExtractor {
  static IE_NAME = "instagram";
  static IE_DESC = "Instagram posts / reels";
  static readonly _VALID_URL = VALID_URL;

  static getInfo(): ExtractorInfo {
    return {
      name: this.IE_NAME,
      description: `${this.IE_DESC} — anonymous scrape; cookies via agent if gated`,
      validUrl: String(this._VALID_URL),
      options: [],
    };
  }

  async extract(url: string): Promise<InfoDict> {
    const shortcode = matchId(url, VALID_URL);
    const pageUrl = url.split("?")[0]!;

    const res = await this.request.request(pageUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        Referer: "https://www.instagram.com/",
      },
    });

    const finalUrl = pageUrl; // undici doesn't expose final URL easily; detect via body
    const webpage = res.body;

    if (
      res.statusCode === 302 ||
      res.statusCode === 301 ||
      /accounts\/login/i.test(webpage.slice(0, 2000)) ||
      /\"login_page\"|\"LoginAndSignupPage\"/i.test(webpage)
    ) {
      throw sessionRequired();
    }

    if (res.statusCode >= 400) {
      throw Object.assign(new Error(`HTTP ${res.statusCode} for ${finalUrl}`), {
        statusCode: res.statusCode,
      });
    }

    const urls = new Set<string>();

    // Direct meta / og tags
    const og = webpage.match(
      /property="og:video(?::secure_url)?"\s+content="([^"]+)"/i,
    ) || webpage.match(/content="([^"]+)"\s+property="og:video(?::secure_url)?"/i);
    if (og?.[1]) urls.add(og[1].replace(/&amp;/g, "&"));

    const contentUrl = webpage.match(
      /"contentUrl"\s*:\s*"(https:\\\/\\\/[^"]+\.mp4[^"]*)"/,
    );
    if (contentUrl?.[1]) {
      urls.add(contentUrl[1].replace(/\\\//g, "/").replace(/\\u0026/g, "&"));
    }

    // JSON blobs
    for (const marker of [
      "window._sharedData = ",
      "window.__additionalDataLoaded(",
      '"video_url":"',
      '"video_versions":',
    ]) {
      const idx = webpage.indexOf(marker);
      if (idx < 0) continue;
      if (marker === '"video_url":"') {
        const m = webpage.slice(idx).match(/"video_url"\s*:\s*"([^"]+)"/);
        if (m?.[1]) urls.add(m[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/"));
        continue;
      }
      const brace = webpage.indexOf("{", idx);
      if (brace >= 0) {
        const obj = extractJsonObject(webpage, brace);
        for (const u of collectVideoUrls(obj)) urls.add(u);
      }
    }

    const scriptJson = extractBetween(
      webpage,
      'type="application/ld+json">',
      "</script>",
    );
    if (scriptJson) {
      const ld = tryParseJson<{ contentUrl?: string; video?: { contentUrl?: string } }>(
        scriptJson,
      );
      const u = ld?.contentUrl || ld?.video?.contentUrl;
      if (u) urls.add(u);
    }

    if (!urls.size) {
      if (/login|challenge|auth_platform/i.test(webpage)) throw sessionRequired();
      throw new Error(
        `Could not find Instagram video URL for ${shortcode}. ` +
          "If the post is private or gated, pass cookies via agent.",
      );
    }

    const formats: Format[] = [...urls].map((u, i) =>
      progressiveFormat(u, {
        format_id: i === 0 ? "http" : `http-${i}`,
        ext: "mp4",
      }),
    );

    const title =
      webpage.match(/property="og:title"\s+content="([^"]+)"/i)?.[1] ||
      webpage.match(/<title>([^<]+)<\/title>/i)?.[1] ||
      shortcode;

    const thumb =
      webpage.match(/property="og:image"\s+content="([^"]+)"/i)?.[1] || undefined;

    return baseInfo("instagram", url, {
      id: shortcode,
      title: title.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))),
      thumbnail: thumb,
      formats,
    });
  }
}
