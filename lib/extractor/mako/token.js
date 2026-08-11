"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAKO_REQUEST_HEADERS = void 0;
exports.fetchMakoTicket = fetchMakoTicket;
exports.buildAuthorizedMakoUrl = buildAuthorizedMakoUrl;
const MAKO_TOKEN_ENDPOINT = "https://mass.mako.co.il/ClicksStatistics/entitlementsServicesV2.jsp?et=gt&rv=AKAMAI";
const DEFAULT_HEADERS = {
    Accept: "application/json,text/plain,*/*",
    "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
    Referer: "https://www.mako.co.il/",
    Origin: "https://www.mako.co.il",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
};
exports.MAKO_REQUEST_HEADERS = DEFAULT_HEADERS;
/** Fetch an Akamai entitlement ticket for a Mako stream path (`lp`). */
async function fetchMakoTicket(request, streamOrTokenUrl) {
    const entitlementUrl = `${MAKO_TOKEN_ENDPOINT}&lp=${encodeURIComponent(streamOrTokenUrl)}`;
    const data = await request.json(entitlementUrl, {
        headers: DEFAULT_HEADERS,
    });
    if (data.status !== "Success" || !data.tickets?.length) {
        throw new Error(`mako: entitlement failed (status=${data.status || "unknown"}) for ${streamOrTokenUrl}`);
    }
    const ticket = data.tickets[0]?.ticket;
    if (!ticket)
        throw new Error("mako: entitlement ticket missing");
    return ticket;
}
/** Append the entitlement ticket query to a stream URL. */
function buildAuthorizedMakoUrl(streamUrl, ticket) {
    // Ticket is already `hdnea=…` (URL-encoded values inside).
    const cleanTicket = ticket.replace(/^\?/, "");
    const separator = streamUrl.includes("?") ? "&" : "?";
    return `${streamUrl}${separator}${cleanTicket}`;
}
//# sourceMappingURL=token.js.map