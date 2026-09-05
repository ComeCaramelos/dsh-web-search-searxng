/**
 * Host half — the session-side record of the exact request about to leave.
 *
 * A search is one plain HTTP GET, so the only way to see afterwards what a
 * provider actually asked for is to record it. The record lands on the
 * initiating Agent's session as a `web/searxng-search-request` event, carrying
 * the endpoint and the query and nothing else: no headers, no key, no reference.
 *
 * Two rules keep this out of the search path's way:
 *
 *   - it runs only when an Agent initiated the search; a search issued by a
 *     human, a test or a scheduled run appends nothing;
 *   - a session that refuses the append must not fail the search, so the
 *     recorder never throws.
 */
import type { AgentRegistry } from "./types/services.js";
import type { PluginContext, SearxngSearchRequestRecord } from "./types/index.js";

/** The session-event type every recorded request carries. */
export const SEARCH_REQUEST_EVENT = "web/searxng-search-request";

/**
 * Append one secret-free request record to the initiating Agent's session.
 * @returns whether a record actually landed.
 */
export function recordSearchRequest(ctx: PluginContext, request: SearxngSearchRequestRecord): boolean {
    // `strict: false` so a composition that mounts no agent registry answers
    // `undefined` instead of throwing: a search may have no initiating Agent.
    const registry = ctx.get("agents", false) as AgentRegistry | undefined;
    const session = registry?.currentInitiator()?.session;
    if (session === undefined) return false;
    session.append(SEARCH_REQUEST_EVENT, { endpoint: request.endpoint, query: request.query });
    return true;
}
