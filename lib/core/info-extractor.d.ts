import type { InfoDict, YoutubeDLParams } from "./types";
import type { RequestClient } from "../networking/request";
export type ExtractorOptionType = "string" | "boolean" | "select" | "multiselect" | "textarea" | "number";
export interface ExtractorOptionDef {
    key: string;
    label: string;
    type: ExtractorOptionType;
    description?: string;
    default?: unknown;
    choices?: Array<{
        value: string;
        label: string;
    }>;
}
export type MigrationStatus = "pending" | "in_progress" | "ready" | "blocked" | "skipped" | "partial" | "planned";
export interface ExtractorInfo {
    name: string;
    description: string;
    validUrl: string;
    options: ExtractorOptionDef[];
    /** From docs/site-migration.json when available */
    status?: MigrationStatus;
    batch?: number | null;
    /** What URL / id the user should paste */
    urlUsage?: string;
    /** Example share / embed / id forms */
    examples?: string[];
    /** Caveats (cookies, geo, pseudo-URLs, etc.) */
    notes?: string;
}
export declare abstract class InfoExtractor {
    static IE_NAME: string;
    static IE_DESC: string;
    static readonly _VALID_URL: RegExp;
    protected readonly params: YoutubeDLParams;
    protected readonly request: RequestClient;
    constructor(params: YoutubeDLParams, request: RequestClient);
    static suitable(url: string): boolean;
    /** UI / API metadata for this extractor */
    static getInfo(): ExtractorInfo;
    abstract extract(url: string): Promise<InfoDict>;
}
export type InfoExtractorConstructor = {
    new (params: YoutubeDLParams, request: RequestClient): InfoExtractor;
    IE_NAME: string;
    IE_DESC: string;
    suitable(url: string): boolean;
    _VALID_URL: RegExp;
    getInfo(): ExtractorInfo;
};
//# sourceMappingURL=info-extractor.d.ts.map