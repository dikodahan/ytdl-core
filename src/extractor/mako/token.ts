import type { RequestClient } from "../../networking/request";

const MAKO_TOKEN_ENDPOINT =
  "https://mass.mako.co.il/ClicksStatistics/entitlementsServicesV2.jsp?et=gt&rv=AKAMAI";

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
  Referer: "https://www.mako.co.il/",
  Origin: "https://www.mako.co.il",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
};

interface MakoTokenResponse {
  caseId?: string;
  status?: string;
  tickets?: Array<{
    vendor?: string;
    ticket?: string;
    url?: string;
  }>;
}

/** Fetch an Akamai entitlement ticket for a Mako stream path (`lp`). */
export async function fetchMakoTicket(
  request: RequestClient,
  streamOrTokenUrl: string,
): Promise<string> {
  const entitlementUrl = `${MAKO_TOKEN_ENDPOINT}&lp=${encodeURIComponent(streamOrTokenUrl)}`;
  const data = await request.json<MakoTokenResponse>(entitlementUrl, {
    headers: DEFAULT_HEADERS,
  });

  if (data.status !== "Success" || !data.tickets?.length) {
    throw new Error(
      `mako: entitlement failed (status=${data.status || "unknown"}) for ${streamOrTokenUrl}`,
    );
  }

  const ticket = data.tickets[0]?.ticket;
  if (!ticket) throw new Error("mako: entitlement ticket missing");
  return ticket;
}

/** Append the entitlement ticket query to a stream URL. */
export function buildAuthorizedMakoUrl(streamUrl: string, ticket: string): string {
  // Ticket is already `hdnea=…` (URL-encoded values inside).
  const cleanTicket = ticket.replace(/^\?/, "");
  const separator = streamUrl.includes("?") ? "&" : "?";
  return `${streamUrl}${separator}${cleanTicket}`;
}

export { DEFAULT_HEADERS as MAKO_REQUEST_HEADERS };
