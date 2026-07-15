import type { ExtractorInfo, InfoExtractorConstructor, ListCapableExtractorConstructor, VideoLister } from "./info-extractor";
import type { YoutubeDLParams } from "./types";
import type { RequestClient } from "../networking/request";
export declare function registerExtractor(ie: InfoExtractorConstructor): void;
export declare function listExtractors(): InfoExtractorConstructor[];
export declare function listExtractorInfo(): ExtractorInfo[];
export declare function findExtractor(url: string): InfoExtractorConstructor | null;
export declare function findExtractorByName(name: string): InfoExtractorConstructor | null;
/** Resolve extractor: force `site`/`service` when set, else first URL match. */
export declare function resolveExtractor(url: string, siteOrService?: string | null): InfoExtractorConstructor | null;
export declare function listListCapableExtractors(): ListCapableExtractorConstructor[];
/** Resolve list extractor: force `site`/`service` when set, else first listing URL match. */
export declare function resolveListExtractor(url: string, siteOrService?: string | null): ListCapableExtractorConstructor | null;
export declare function createVideoLister(ie: ListCapableExtractorConstructor, params: YoutubeDLParams, request: RequestClient): VideoLister;
//# sourceMappingURL=registry.d.ts.map