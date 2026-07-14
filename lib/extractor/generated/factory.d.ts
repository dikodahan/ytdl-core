import { type InfoExtractorConstructor } from "../../core/info-extractor";
export interface GeneratedCatalogEntry {
    id: string;
    ieClass?: string;
    ieName?: string;
    description: string;
    patterns: string[];
    hosts: string[];
    module?: string;
    source?: string;
}
export declare function createGeneratedExtractor(entry: GeneratedCatalogEntry): InfoExtractorConstructor;
//# sourceMappingURL=factory.d.ts.map