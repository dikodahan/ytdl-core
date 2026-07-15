import { PassThrough, type Readable } from "stream";
import { listExtractors, resolveExtractor, resolveListExtractor, createVideoLister } from "./registry";
import type { InfoDict, YoutubeDLParams } from "./types";
import type { ListVideosOptions, VideoListResult } from "./video-list";
import type { ExtractorInfo } from "./info-extractor";
import { RequestClient, createAgent, createProxyAgent } from "../networking/request";
import { selectFormats } from "./format-select";
import { downloadFormat, type DownloadOptions } from "../downloader/http";
import { isImpersonateAvailable } from "../networking/cloudflare";
import { registerBuiltInExtractors } from "../extractor/register";

registerBuiltInExtractors();

export class YoutubeDL {
  readonly params: YoutubeDLParams;
  readonly request: RequestClient;

  constructor(params: YoutubeDLParams = {}) {
    this.params = { ...params };
    if (params.site && !params.service) this.params.service = params.site;
    if (params.service && !params.site) this.params.site = params.service;
    if (params.proxy && !params.agent) {
      this.params.agent = createProxyAgent(params.proxy);
    } else if (!params.agent) {
      this.params.agent = createAgent();
    }
    this.request = new RequestClient({
      agent: this.params.agent,
      defaultHeaders: this.params.headers,
      impersonate: this.params.impersonate,
      cloudflareBypass: this.params.cloudflareBypass,
      forceImpersonate: this.params.forceImpersonate,
      proxy: this.params.proxy,
    });
  }

  get extractors() {
    return listExtractors();
  }

  static listSites(): ExtractorInfo[] {
    return listExtractors().map(ie => ie.getInfo());
  }

  static capabilities() {
    return {
      impersonateAvailable: isImpersonateAvailable(),
      impersonateProfiles: ["chrome", "firefox", "safari", "edge"] as const,
      cloudflareBypass: true,
    };
  }

  async extractInfo(url: string, _download = false): Promise<InfoDict> {
    const site = this.params.site || this.params.service;
    let IE;
    try {
      IE = resolveExtractor(url, site);
    } catch (err) {
      throw err;
    }
    if (!IE) {
      throw new Error(
        site ? `Unknown or unregistered service: ${site}` : `No suitable extractor for URL: ${url}`,
      );
    }
    const ie = new IE(this.params, this.request);
    const info = await ie.extract(url);

    if (this.params.format && info.formats?.length) {
      const selected = selectFormats(info.formats, this.params.format);
      info.requested_formats = selected.formats;
      if (!selected.merged && selected.formats[0]) {
        info.url = selected.formats[0].url;
        info.ext = selected.formats[0].ext;
      }
    }

    return info;
  }

  async listVideos(url: string, options: ListVideosOptions = {}): Promise<VideoListResult> {
    const site = this.params.site || this.params.service;
    let IE;
    try {
      IE = resolveListExtractor(url, site);
    } catch (err) {
      throw err;
    }
    if (!IE) {
      throw new Error(
        site
          ? `Service "${site}" does not support listing video ids for this URL`
          : `No list-capable extractor for URL: ${url}`,
      );
    }
    const lister = createVideoLister(IE, this.params, this.request);
    return lister.listVideos(url, options);
  }

  download(url: string, options: DownloadOptions = {}): Readable {
    const stream = new PassThrough({ highWaterMark: options.highWaterMark || 1024 * 512 });
    this.extractInfo(url)
      .then(info => {
        const formats = info.requested_formats || info.formats || [];
        const selected = selectFormats(formats, this.params.format || "best");
        const format = selected.formats[0];
        stream.emit("info", info, format);
        const media = downloadFormat(format, this.params, options);
        media.on("error", err => stream.emit("error", err));
        media.on("progress", (...args: unknown[]) => stream.emit("progress", ...args));
        media.pipe(stream);
      })
      .catch(err => stream.emit("error", err));
    return stream;
  }

  async close(): Promise<void> {
    await this.request.close();
  }
}

export async function extractInfo(url: string, params: YoutubeDLParams = {}): Promise<InfoDict> {
  const ydl = new YoutubeDL(params);
  try {
    return await ydl.extractInfo(url);
  } finally {
    await ydl.close();
  }
}

export async function listVideos(
  url: string,
  params: YoutubeDLParams & ListVideosOptions = {},
): Promise<VideoListResult> {
  const { page, limit, ...rest } = params;
  const ydl = new YoutubeDL(rest);
  try {
    return await ydl.listVideos(url, { page, limit });
  } finally {
    await ydl.close();
  }
}
