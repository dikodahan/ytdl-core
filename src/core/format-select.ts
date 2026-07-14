import type { Format } from "./types";

export type FormatFilter = (format: Format) => boolean;

function hasVideo(f: Format): boolean {
  return !!(f.has_video ?? (f.vcodec && f.vcodec !== "none"));
}

function hasAudio(f: Format): boolean {
  return !!(f.has_audio ?? (f.acodec && f.acodec !== "none"));
}

export function filterFormats(formats: Format[], filter?: string | FormatFilter): Format[] {
  if (!filter) return formats.slice();
  if (typeof filter === "function") return formats.filter(filter);

  switch (filter) {
    case "audioandvideo":
    case "videoandaudio":
      return formats.filter(f => hasVideo(f) && hasAudio(f));
    case "video":
    case "videoonly":
      return formats.filter(f => hasVideo(f) && (filter === "video" || !hasAudio(f)));
    case "audio":
    case "audioonly":
      return formats.filter(f => hasAudio(f) && (filter === "audio" || !hasVideo(f)));
    default:
      return formats.slice();
  }
}

function score(f: Format): number {
  const height = f.height || 0;
  const tbr = f.tbr || f.bitrate || 0;
  const muxed = hasVideo(f) && hasAudio(f) ? 1_000_000_000 : 0;
  const video = hasVideo(f) ? 10_000_000 : 0;
  const audio = hasAudio(f) ? 1_000_000 : 0;
  return muxed + video + audio + height * 1000 + Number(tbr);
}

export function sortFormats(formats: Format[]): Format[] {
  return formats.slice().sort((a, b) => score(b) - score(a));
}

/**
 * Minimal yt-dlp-like format selector.
 * Supports: best, worst, bestvideo, bestaudio, worstvideo, worstaudio,
 * and simple merges bestvideo+bestaudio (returns both formats).
 */
export function selectFormats(
  formats: Format[],
  selector = "best",
): { formats: Format[]; merged: boolean } {
  const playable = formats.filter(f => f.url || f.manifest_url);
  if (!playable.length) {
    throw new Error("No playable formats available");
  }

  const sorted = sortFormats(playable);

  if (selector.includes("+")) {
    const [vSel, aSel] = selector.split("+");
    const video = selectOne(sorted, vSel || "bestvideo");
    const audio = selectOne(sorted, aSel || "bestaudio");
    if (!video || !audio) {
      throw new Error(`Could not resolve format selector: ${selector}`);
    }
    return { formats: [video, audio], merged: true };
  }

  const one = selectOne(sorted, selector);
  if (!one) throw new Error(`Could not resolve format selector: ${selector}`);
  return { formats: [one], merged: false };
}

function selectOne(sorted: Format[], selector: string): Format | undefined {
  switch (selector) {
    case "best":
      return sorted[0];
    case "worst":
      return sorted[sorted.length - 1];
    case "bestvideo":
    case "highestvideo":
      return sorted.find(f => hasVideo(f) && !hasAudio(f)) || sorted.find(f => hasVideo(f));
    case "worstvideo":
    case "lowestvideo":
      return [...sorted].reverse().find(f => hasVideo(f) && !hasAudio(f)) ||
        [...sorted].reverse().find(f => hasVideo(f));
    case "bestaudio":
    case "highestaudio":
      return sorted.find(f => hasAudio(f) && !hasVideo(f)) || sorted.find(f => hasAudio(f));
    case "worstaudio":
    case "lowestaudio":
      return [...sorted].reverse().find(f => hasAudio(f) && !hasVideo(f)) ||
        [...sorted].reverse().find(f => hasAudio(f));
    case "highest":
      return sorted[0];
    case "lowest":
      return sorted[sorted.length - 1];
    default: {
      const byId = sorted.find(f => f.format_id === selector || String(f.itag) === selector);
      if (byId) return byId;
      return sorted[0];
    }
  }
}

/** Compat helper matching classic ytdl-core chooseFormat quality strings */
export function chooseFormat(
  formats: Format[],
  options: { quality?: string | number | string[] | number[]; filter?: string | FormatFilter; format?: Format } = {},
): Format {
  if (options.format) {
    if (!options.format.url && !options.format.manifest_url) {
      throw new Error("Invalid format given, did you use getInfo()?");
    }
    return options.format;
  }

  let list = filterFormats(formats, options.filter as string | FormatFilter | undefined);
  if (list.some(f => f.isHLS)) {
    list = list.filter(f => f.isHLS || !f.is_live);
  }
  if (!list.length) {
    throw new Error(`No such format found`);
  }

  const quality = options.quality ?? "highest";
  if (Array.isArray(quality)) {
    for (const q of quality) {
      const match = list.find(f => f.itag === Number(q) || f.format_id === String(q));
      if (match) return match;
    }
    throw new Error(`No such format found: ${quality}`);
  }
  if (typeof quality === "number") {
    const match = list.find(f => f.itag === quality || f.format_id === String(quality));
    if (!match) throw new Error(`No such format found: ${quality}`);
    return match;
  }

  const { formats: selected } = selectFormats(list, quality === "highest" ? "best" : quality === "lowest" ? "worst" : quality);
  return selected[0];
}
