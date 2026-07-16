import type { YoutubeDLParams } from "../core/types";
import { YoutubeDL } from "../core/youtube-dl";
import { discoverKalturaOttPartner } from "../extractor/kaltura-ott/discover";

export interface DiscoverKalturaOttRequest {
  url: string;
  deepScan?: boolean;
  deepScanLimit?: number;
  proxy?: string;
  impersonate?: YoutubeDLParams["impersonate"];
  cloudflareBypass?: boolean;
}

export function parseDiscoverKalturaOttBody(raw: string): DiscoverKalturaOttRequest {
  const data = JSON.parse(raw || "{}") as Record<string, unknown>;
  const url = typeof data.url === "string" ? data.url.trim() : "";
  if (!url) throw new Error("url is required");

  return {
    url,
    deepScan: data.deepScan === true,
    deepScanLimit:
      typeof data.deepScanLimit === "number" && data.deepScanLimit > 0
        ? Math.min(Math.floor(data.deepScanLimit), 500)
        : undefined,
    proxy: typeof data.proxy === "string" && data.proxy ? data.proxy : undefined,
    impersonate:
      data.impersonate === false || data.impersonate == null || data.impersonate === ""
        ? undefined
        : (data.impersonate as YoutubeDLParams["impersonate"]),
    cloudflareBypass: data.cloudflareBypass === true,
  };
}

export async function runDiscoverKalturaOtt(parsed: DiscoverKalturaOttRequest) {
  const started = Date.now();
  const ydl = new YoutubeDL({
    quiet: true,
    proxy: parsed.proxy,
    impersonate: parsed.impersonate,
    cloudflareBypass: parsed.cloudflareBypass,
  });

  try {
    const result = await discoverKalturaOttPartner(ydl.request, parsed.url, {
      deepScan: parsed.deepScan,
      deepScanLimit: parsed.deepScanLimit,
    });

    return {
      status: 200 as const,
      body: {
        ...result,
        elapsedMs: Date.now() - started,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 500 as const,
      body: { ok: false, error: message, elapsedMs: Date.now() - started },
    };
  } finally {
    await ydl.close?.().catch(() => undefined);
  }
}
