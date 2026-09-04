import type { RequestClient } from "../../networking/request";

export const AJ_NETWORK_ORIGIN = "https://network.aljazeera.net";
export const AJ_CHANNELS_URL = `${AJ_NETWORK_ORIGIN}/en/channels`;

export interface AjChannelInfo {
  id: string;
  title: string;
  pageUrl: string;
  thumbnail: string | null;
  /** Live page used for stream extraction, when known. */
  liveUrl: string | null;
}

/** Broadcast / streamable channel IDs → live watch pages. */
export const AJ_CHANNEL_LIVE_URLS: Record<string, string> = {
  aljazeera: "https://www.aljazeera.net/live",
  "aljazeera-english": "https://www.aljazeera.com/live",
  "aljazeera-mubasher": "https://mubasher.aljazeera.net/",
  "aljazeera-documentary": "https://doc.aljazeera.net/",
};

/** Short aliases for `aljazeera:{alias}` pseudo-URLs. */
export const AJ_CHANNEL_ALIASES: Record<string, string> = {
  arabic: "aljazeera",
  aja: "aljazeera",
  english: "aljazeera-english",
  aje: "aljazeera-english",
  mubasher: "aljazeera-mubasher",
  ajm: "aljazeera-mubasher",
  documentary: "aljazeera-documentary",
  doc: "aljazeera-documentary",
  ajd: "aljazeera-documentary",
};

const WP_SITE_BY_HOST: Record<string, string> = {
  "balkans.aljazeera.net": "ajb",
  "chinese.aljazeera.net": "chinese",
  "mubasher.aljazeera.net": "ajm",
  "www.aljazeera.com": "aje",
  "aljazeera.com": "aje",
  "www.aljazeera.net": "aja",
  "aljazeera.net": "aja",
};

export interface AjGraphqlVideo {
  id?: string;
  accountId?: string;
  playerId?: string;
  name?: string;
  duration?: string;
}

interface AjGraphqlArticle {
  title?: string;
  video?: AjGraphqlVideo | null;
}

const BRIGHTCOVE_EMBED_RE =
  /https?:\/\/players\.brightcove\.net\/(?<account>\d+)\/(?<player>[^/_]+)_(?<embed>[^/?#]+)\/index\.html\?(?:[^"'<\s]*&)?(?:videoId|playlistId)=(?<id>\d+|ref:[^&"'<\s]+)/i;

const YOUTUBE_EMBED_RE = /(?:youtube\.com\/embed\/|youtu\.be\/)(?<id>[A-Za-z0-9_-]{11})/i;

function absUrl(pathOrUrl: string, base: string): string {
  try {
    return new URL(pathOrUrl, base).toString();
  } catch {
    return pathOrUrl;
  }
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function ajChannelPageUrl(channelId: string): string {
  return `${AJ_CHANNELS_URL}/${channelId}`;
}

export function normalizeAjChannelId(raw: string): string {
  const key = raw.trim().toLowerCase();
  return AJ_CHANNEL_ALIASES[key] || key;
}

export function resolveAjLiveUrl(channelId: string): string | null {
  return AJ_CHANNEL_LIVE_URLS[normalizeAjChannelId(channelId)] || null;
}

export function wpSiteForHost(host: string): string {
  return WP_SITE_BY_HOST[host.toLowerCase()] || "aje";
}

export function postTypeFromPathType(typePath: string | undefined): string {
  const head = (typePath || "news").split("/")[0].toLowerCase();
  const map: Record<string, string> = {
    features: "post",
    feature: "post",
    program: "episode",
    programs: "episode",
    videos: "video",
    video: "video",
    news: "news",
  };
  return map[head] || "news";
}

/** Discover channel IDs from network.aljazeera.net/{en|ar}/channels. */
export function parseAjChannelsHtml(html: string, listUrl = AJ_CHANNELS_URL): AjChannelInfo[] {
  const out: AjChannelInfo[] = [];
  const seen = new Set<string>();
  const re =
    /<h5[^>]*>\s*([\s\S]*?)\s*<\/h5>[\s\S]{0,1600}?href="(\/(?:en|ar)\/channels\/([^"#]+))"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const title = decodeHtml(m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
    const id = decodeURIComponent(m[3]).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const window = html.slice(m.index, m.index + 1800);
    const img = window.match(/<img[^>]+src="([^"]+)"/i)?.[1] || null;
    out.push({
      id,
      title: title || id,
      pageUrl: ajChannelPageUrl(id),
      thumbnail: img ? absUrl(img, listUrl) : null,
      liveUrl: resolveAjLiveUrl(id),
    });
  }
  return out;
}

export async function discoverAjChannels(request: RequestClient): Promise<AjChannelInfo[]> {
  const html = await request.text(AJ_CHANNELS_URL, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      Referer: `${AJ_NETWORK_ORIGIN}/`,
    },
  });
  const channels = parseAjChannelsHtml(html, AJ_CHANNELS_URL);
  if (!channels.length) throw new Error("aljazeera: no channels found on network channels page");
  return channels;
}

export function findBrightcovePlayerUrl(html: string): string | null {
  const m = html.match(BRIGHTCOVE_EMBED_RE);
  if (!m?.groups) return null;
  const { account, player, embed, id } = m.groups;
  return `https://players.brightcove.net/${account}/${player}_${embed}/index.html?videoId=${id}`;
}

export function findYoutubeVideoId(html: string): string | null {
  return html.match(YOUTUBE_EMBED_RE)?.groups?.id || null;
}

export async function fetchAjArticleVideo(
  request: RequestClient,
  pageUrl: string,
  displayId: string,
  pathType: string | undefined,
): Promise<{ title: string | null; video: AjGraphqlVideo | null; webpage: string | null }> {
  const host = new URL(pageUrl).hostname;
  const wpSite = wpSiteForHost(host);
  const postType = postTypeFromPathType(pathType);
  const variables = JSON.stringify({ name: displayId, postType });
  const api = new URL(`https://${host}/graphql`);
  api.searchParams.set("wp-site", wpSite);
  api.searchParams.set("operationName", "ArchipelagoSingleArticleQuery");
  api.searchParams.set("variables", variables);

  try {
    const data = await request.json<{ data?: { article?: AjGraphqlArticle | null } }>(api.toString(), {
      headers: {
        Accept: "application/json",
        "wp-site": wpSite,
        Referer: pageUrl,
      },
    });
    const article = data.data?.article;
    if (article?.video?.id) {
      return { title: article.title || null, video: article.video, webpage: null };
    }
  } catch {
    /* fall through to webpage scrape */
  }

  const webpage = await request.text(pageUrl, {
    headers: { Accept: "text/html,application/xhtml+xml", Referer: `https://${host}/` },
  });
  return { title: null, video: null, webpage };
}

export function brightcoveUrlFromVideo(video: AjGraphqlVideo): string {
  const account = video.accountId || "911432371001";
  const player = video.playerId || "csvTfAlKW";
  const id = video.id!;
  return `https://players.brightcove.net/${account}/${player}_default/index.html?videoId=${id}`;
}
