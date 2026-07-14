import * as http from "http";
export interface WebServerOptions {
    host?: string;
    port?: number;
    /** When true, lab /api/extract and /api/meta also require a Bearer token (even on loopback). */
    requireAuth?: boolean;
}
export declare function createWebServer(options?: WebServerOptions): http.Server;
export declare function startWebServer(options?: WebServerOptions): http.Server;
//# sourceMappingURL=server.d.ts.map