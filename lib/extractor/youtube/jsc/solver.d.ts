import type { RequestClient } from "../../../networking/request";
export type ChallengeType = "n" | "sig";
export interface ChallengeRequest {
    type: ChallengeType;
    challenges: string[];
    playerUrl: string;
    videoId?: string;
}
export interface ChallengeResponse {
    type: ChallengeType;
    /** Map of challenge input → solved output (EJS / yt-dlp shape) */
    results: Record<string, string>;
}
export declare class NodeEjsChallengeSolver {
    private readonly playerCache;
    private readonly request;
    constructor(request: RequestClient);
    solve(requests: ChallengeRequest[]): Promise<ChallengeResponse[]>;
    private getPlayer;
    private runSolver;
}
export declare const EJS_SCRIPT_VERSION = "0.8.0";
//# sourceMappingURL=solver.d.ts.map