import type { ExtractorInfo, InfoExtractorConstructor } from "./info-extractor";
export declare function registerExtractor(ie: InfoExtractorConstructor): void;
export declare function listExtractors(): InfoExtractorConstructor[];
export declare function listExtractorInfo(): ExtractorInfo[];
export declare function findExtractor(url: string): InfoExtractorConstructor | null;
export declare function findExtractorByName(name: string): InfoExtractorConstructor | null;
/** Resolve extractor: force `site`/`service` when set, else first URL match. */
export declare function resolveExtractor(url: string, siteOrService?: string | null): InfoExtractorConstructor | null;
//# sourceMappingURL=registry.d.ts.map