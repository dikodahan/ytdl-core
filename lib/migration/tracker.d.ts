import type { MigrationStatus } from "../core/info-extractor";
export interface MigrationModule {
    id: string;
    status: MigrationStatus;
    ies?: string[];
}
export interface MigrationBatch {
    id: number;
    title: string;
    status: string;
    modules: MigrationModule[];
}
export interface MigrationTracker {
    upstreamPin: string;
    depth: string;
    youtube?: MigrationModule;
    batches: MigrationBatch[];
}
export declare function loadMigrationTracker(force?: boolean): MigrationTracker;
export declare function migrationStatusBySite(): Map<string, {
    status: MigrationStatus;
    batch: number | null;
}>;
export declare function listPlannedModules(): Array<MigrationModule & {
    batch: number;
    batchTitle: string;
}>;
//# sourceMappingURL=tracker.d.ts.map