import type { Format, InfoDict } from "../../core/types";

export function matchId(url: string, re: RegExp, group: string | number = "id"): string {
  const m = url.match(re);
  if (!m) throw new Error(`Could not extract id from URL: ${url}`);
  if (typeof group === "number") {
    const id = m[group];
    if (!id) throw new Error(`Could not extract id from URL: ${url}`);
    return id;
  }
  const id = (m.groups && m.groups[group]) || m[1];
  if (!id) throw new Error(`Could not extract id from URL: ${url}`);
  return id;
}

export function hlsFormat(url: string, formatId = "hls"): Format {
  return {
    format_id: formatId,
    url,
    manifest_url: url,
    ext: "mp4",
    protocol: "m3u8_native",
    isHLS: true,
    has_video: true,
    has_audio: true,
    vcodec: "unknown",
    acodec: "unknown",
  };
}

export type HlsMasterVariant = {
  height: number;
  width: number;
  bandwidth: number;
  name: string;
  playlistUrl: string;
};

/** Parse `#EXT-X-STREAM-INF` variants from an HLS master playlist body. */
export function parseHlsMasterPlaylist(
  masterUrl: string,
  body: string,
): HlsMasterVariant[] {
  const variants: HlsMasterVariant[] = [];
  const base = new URL(masterUrl);
  const lines = body.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() || "";
    if (!line.startsWith("#EXT-X-STREAM-INF:")) continue;

    const res = line.match(/RESOLUTION=(\d+)x(\d+)/i);
    const name = line.match(/NAME="([^"]+)"/i)?.[1];
    const bw = line.match(/BANDWIDTH=(\d+)/i)?.[1];
    const playlist = lines[i + 1]?.trim();
    if (!playlist || playlist.startsWith("#")) continue;

    variants.push({
      width: res ? Number(res[1]) : 0,
      height: res ? Number(res[2]) : 0,
      bandwidth: bw ? Number(bw) : 0,
      name: name || (res ? `${res[2]}p` : "hls"),
      playlistUrl: new URL(playlist, base).toString(),
    });
  }

  return variants;
}

/**
 * Expand master `m3u8` formats into per-variant HLS entries (with height / qualityLabel).
 * Leaves progressive formats untouched. Falls back to the original master when fetch fails.
 */
export async function expandHlsMasterFormats(
  formats: Format[],
  fetchText: (url: string) => Promise<string>,
): Promise<Format[]> {
  const out: Format[] = [];
  const seen = new Set<string>();

  for (const format of formats) {
    const url = format.url || format.manifest_url;
    const isMaster =
      !!url &&
      (format.isHLS || /\.m3u8($|\?)/i.test(url)) &&
      !/hls-\d+p/i.test(String(format.format_id || ""));

    if (!isMaster || !url) {
      if (url && !seen.has(url)) {
        seen.add(url);
        out.push(format);
      } else if (!url) {
        out.push(format);
      }
      continue;
    }

    try {
      const body = await fetchText(url);
      const variants = parseHlsMasterPlaylist(url, body);
      if (!variants.length) {
        if (!seen.has(url)) {
          seen.add(url);
          out.push(format);
        }
        continue;
      }
      for (const variant of variants) {
        if (seen.has(variant.playlistUrl)) continue;
        seen.add(variant.playlistUrl);
        out.push({
          ...hlsFormat(
            variant.playlistUrl,
            `hls-${variant.name.replace(/\s+/g, "_").toLowerCase()}`,
          ),
          height: variant.height || null,
          width: variant.width || null,
          resolution:
            variant.width && variant.height
              ? `${variant.width}x${variant.height}`
              : undefined,
          qualityLabel: variant.name,
          tbr: variant.bandwidth ? Math.round(variant.bandwidth / 1000) : null,
          http_headers: format.http_headers,
        });
      }
    } catch {
      if (!seen.has(url)) {
        seen.add(url);
        out.push(format);
      }
    }
  }

  return out;
}

export function dashFormat(url: string, formatId = "dash"): Format {
  return {
    format_id: formatId,
    url,
    manifest_url: url,
    ext: "mp4",
    protocol: "http_dash_segments",
    isDashMPD: true,
    has_video: true,
    has_audio: true,
    vcodec: "unknown",
    acodec: "unknown",
  };
}

export function progressiveFormat(
  url: string,
  opts: Partial<Format> & { format_id?: string } = {},
): Format {
  const ext = opts.ext || guessExt(url) || "mp4";
  return {
    format_id: opts.format_id || "http",
    url,
    ext,
    protocol: "https",
    has_video: opts.has_video ?? !/audio|mp3|aac|m4a/i.test(ext),
    has_audio: opts.has_audio ?? true,
    vcodec: opts.vcodec ?? (opts.has_video === false ? "none" : "unknown"),
    acodec: opts.acodec ?? "unknown",
    width: opts.width ?? null,
    height: opts.height ?? null,
    tbr: opts.tbr ?? null,
    filesize: opts.filesize ?? null,
    ...opts,
  };
}

function guessExt(url: string): string | undefined {
  const path = url.split("?")[0] || "";
  const m = path.match(/\.([a-z0-9]{2,5})$/i);
  return m?.[1]?.toLowerCase();
}

export function baseInfo(
  extractor: string,
  url: string,
  fields: Omit<InfoDict, "extractor" | "extractor_key" | "webpage_url" | "original_url"> & {
    id: string;
  },
): InfoDict {
  return {
    ...fields,
    extractor,
    extractor_key: extractor,
    webpage_url: url,
    original_url: url,
  };
}

export function extractBetween(html: string, left: string, right: string): string | null {
  const i = html.indexOf(left);
  if (i < 0) return null;
  const start = i + left.length;
  const j = html.indexOf(right, start);
  if (j < 0) return null;
  return html.slice(start, j);
}

export function tryParseJson<T = unknown>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Find first balanced `{...}` JSON object starting at `from` index of `{`. */
export function extractJsonObject(html: string, from: number): unknown | null {
  if (html[from] !== "{") return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = from; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return tryParseJson(html.slice(from, i + 1));
      }
    }
  }
  return null;
}

export function searchJsonAssignment(html: string, assignRe: RegExp): unknown | null {
  const m = html.match(assignRe);
  if (!m || m.index == null) return null;
  const brace = html.indexOf("{", m.index + m[0].length - 1);
  if (brace < 0) return null;
  return extractJsonObject(html, brace);
}
