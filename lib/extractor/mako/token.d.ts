import type { RequestClient } from "../../networking/request";
declare const DEFAULT_HEADERS: Record<string, string>;
/** Fetch an Akamai entitlement ticket for a Mako stream path (`lp`). */
export declare function fetchMakoTicket(request: RequestClient, streamOrTokenUrl: string): Promise<string>;
/** Append the entitlement ticket query to a stream URL. */
export declare function buildAuthorizedMakoUrl(streamUrl: string, ticket: string): string;
export { DEFAULT_HEADERS as MAKO_REQUEST_HEADERS };
//# sourceMappingURL=token.d.ts.map