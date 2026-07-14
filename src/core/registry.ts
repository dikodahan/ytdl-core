import type { ExtractorInfo, InfoExtractorConstructor } from "./info-extractor";
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
