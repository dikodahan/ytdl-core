import type {
  ExtractorInfo,
  InfoExtractorConstructor,
  ListCapableExtractorConstructor,
  VideoLister,
} from "./info-extractor";
import type { YoutubeDLParams } from "./types";
import type { RequestClient } from "../networking/request";
import { withUrlUsage } from "../extractor/url-usage";

const extractors: InfoExtractorConstructor[] = [];

export function registerExtractor(ie: InfoExtractorConstructor): void {
  if (!extractors.includes(ie)) {
    extractors.push(ie);
  }
}

export function listExtractors(): InfoExtractorConstructor[] {
  return [...extractors];
}

export function listExtractorInfo(): ExtractorInfo[] {
  return extractors.map(ie => withUrlUsage(ie.getInfo()));
}

export function findExtractor(url: string): InfoExtractorConstructor | null {
  for (const ie of extractors) {
    if (ie.suitable(url)) {
      return ie;
    }
  }
  return null;
}

export function findExtractorByName(name: string): InfoExtractorConstructor | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  for (const ie of extractors) {
    if (ie.IE_NAME.toLowerCase() === needle) return ie;
  }
  return null;
}

/** Resolve extractor: force `site`/`service` when set, else first URL match. */
export function resolveExtractor(
  url: string,
  siteOrService?: string | null,
): InfoExtractorConstructor | null {
  if (siteOrService) {
    const IE = findExtractorByName(siteOrService);
    if (!IE) return null;
    if (!IE.suitable(url)) {
      const err = new Error(
        `URL is not valid for service "${IE.IE_NAME}"`,
      ) as Error & { code?: string };
      err.code = "SITE_URL_MISMATCH";
      throw err;
    }
    return IE;
  }
  return findExtractor(url);
}

function isListCapable(ie: InfoExtractorConstructor): ie is ListCapableExtractorConstructor {
  return typeof (ie as ListCapableExtractorConstructor).listUrlSupported === "function" &&
    typeof ie.prototype.listVideos === "function";
}

export function listListCapableExtractors(): ListCapableExtractorConstructor[] {
  return extractors.filter(isListCapable);
}

/** Resolve list extractor: force `site`/`service` when set, else first listing URL match. */
export function resolveListExtractor(
  url: string,
  siteOrService?: string | null,
): ListCapableExtractorConstructor | null {
  if (siteOrService) {
    const IE = findExtractorByName(siteOrService);
    if (!IE || !isListCapable(IE)) return null;
    if (!IE.listUrlSupported(url)) {
      const err = new Error(
        `URL is not a supported listing page for service "${IE.IE_NAME}"`,
      ) as Error & { code?: string };
      err.code = "SITE_URL_MISMATCH";
      throw err;
    }
    return IE;
  }
  for (const ie of extractors) {
    if (isListCapable(ie) && ie.listUrlSupported(url)) return ie;
  }
  return null;
}

export function createVideoLister(
  ie: ListCapableExtractorConstructor,
  params: YoutubeDLParams,
  request: RequestClient,
): VideoLister {
  return new ie(params, request) as unknown as VideoLister;
}
