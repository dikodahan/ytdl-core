import { PassThrough, type Readable } from "stream";
import { request as undiciRequest } from "undici";
import type { Format, YoutubeDLParams } from "../core/types";

export interface DownloadOptions {
  range?: { start?: number; end?: number };
  highWaterMark?: number;
  dlChunkSize?: number;
  begin?: string | number | Date;
  liveBuffer?: number;
}

export function downloadFormat(
  format: Format,
  params: YoutubeDLParams = {},
  options: DownloadOptions = {},
): Readable {
  const stream = new PassThrough({ highWaterMark: options.highWaterMark || 1024 * 512 });

  const url = format.url || format.manifest_url;
  if (!url) {
    queueMicrotask(() => stream.emit("error", new Error("Format has no URL")));
    return stream;
  }

  if (format.isHLS || format.protocol === "m3u8_native" || format.isDashMPD) {
    // Lazy-require to keep core usable without m3u8stream for progressive-only paths
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const m3u8stream = require("m3u8stream") as typeof import("m3u8stream");
      const begin =
        options.begin instanceof Date
          ? options.begin.getTime()
          : options.begin || (format.is_live ? Date.now() : undefined);
      const req = m3u8stream(url, {
        begin,
        liveBuffer: options.liveBuffer,
        parser: format.isDashMPD ? "dash-mpd" : "m3u8",
        requestOptions: {
          headers: {
            ...(params.headers || {}),
            ...(params.agent?.jar ? { Cookie: params.agent.jar.getCookieStringSync(url) } : {}),
          },
        } as Record<string, unknown>,
      });
      req.on("error", err => stream.emit("error", err));
      req.pipe(stream);
    } catch (err) {
      queueMicrotask(() => stream.emit("error", err));
    }
    return stream;
  }

  void downloadHttp(url, stream, params, options, format);
  return stream;
}

async function downloadHttp(
  url: string,
  stream: PassThrough,
  params: YoutubeDLParams,
  options: DownloadOptions,
  format: Format,
): Promise<void> {
  const dlChunkSize = typeof options.dlChunkSize === "number" ? options.dlChunkSize : 1024 * 1024 * 10;
  const headers: Record<string, string> = {
    ...(params.headers || {}),
  };
  if (params.agent?.jar) {
    headers.Cookie = params.agent.jar.getCookieStringSync(url);
  }

  const contentLength = format.contentLength ? parseInt(format.contentLength, 10) : 0;
  const shouldChunk =
    dlChunkSize !== 0 && !(format.has_audio && format.has_video) && contentLength > dlChunkSize;

  try {
    if (shouldChunk) {
      let start = options.range?.start || 0;
      let end = start + dlChunkSize - 1;
      const rangeEnd = options.range?.end;
      const total = rangeEnd != null ? rangeEnd : contentLength - 1;
      let downloaded = 0;

      while (start <= total && !stream.destroyed) {
        if (end > total) end = total;
        const res = await undiciRequest(url, {
          method: "GET",
          headers: { ...headers, Range: `bytes=${start}-${end}` },
          dispatcher: params.agent?.dispatcher,
        });
        if (res.statusCode >= 400 && res.statusCode !== 206) {
          throw new Error(`HTTP ${res.statusCode} downloading media`);
        }
        for await (const chunk of res.body) {
          if (stream.destroyed) return;
          downloaded += chunk.length;
          stream.emit("progress", chunk.length, downloaded, contentLength || total + 1);
          stream.write(chunk);
        }
        if (end >= total) break;
        start = end + 1;
        end = start + dlChunkSize - 1;
      }
      stream.end();
    } else {
      if (options.range?.start != null || options.range?.end != null) {
        headers.Range = `bytes=${options.range.start || 0}-${options.range.end ?? ""}`;
      }
      const res = await undiciRequest(url, {
        method: "GET",
        headers,
        dispatcher: params.agent?.dispatcher,
      });
      if (res.statusCode >= 400) {
        throw new Error(`HTTP ${res.statusCode} downloading media`);
      }
      const cl = parseInt(String(res.headers["content-length"] || contentLength || 0), 10);
      let downloaded = 0;
      for await (const chunk of res.body) {
        if (stream.destroyed) return;
        downloaded += chunk.length;
        stream.emit("progress", chunk.length, downloaded, cl);
        stream.write(chunk);
      }
      stream.end();
    }
  } catch (err) {
    stream.emit("error", err);
  }
}
