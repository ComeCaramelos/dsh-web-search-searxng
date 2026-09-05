/**
 * Host half — the one HTTP request one search turns into.
 *
 * Building it is separate from driving it so the wire contract — endpoint,
 * parameters and headers — reads in one screen, and so the anti-bot measures
 * stay documented where they belong rather than scattered through a fetch call.
 *
 * The URL is `{baseURL}/search` with:
 *
 *   - `format=json`, the only shape the mapper reads;
 *   - `count`, a cost/latency hint — the seam re-applies its own `maxResults`
 *     on the way back, which is why the mapper never reports `truncated`;
 *   - `language`, only when a preference is real (`all` means "ask nothing").
 *
 * The headers matter more than they look: SearXNG's limiter is what rejects
 * requests here, not its search logic. See {@link ./constants.ts TRUSTED_FORWARDED_FOR}.
 */
import {
    ACCEPT_HEADER,
    ACCEPT_LANGUAGE_HEADER,
    BROWSER_USER_AGENT,
    TRUSTED_FORWARDED_FOR
} from "./constants.js";
import type { SearxngSearchOptions } from "./types/index.js";

/** The method and headers one search dispatches with. */
export interface SearxngRequestInit {
    method: "GET";
    /** SearXNG answers a JSON-API query with a 307 now and then. */
    redirect: "follow";
    headers: Record<string, string>;
}

/**
 * Build the GET for one search: URL plus request init, no key material.
 * @param options - the resolved options for this search.
 * @param query - the query string to send.
 * @param apiKey - the key to authorizes with, when there is one.
 * @returns the absolute URL and the init to dispatch it with.
 */
export function buildSearchRequest(
    options: SearxngSearchOptions,
    query: string,
    apiKey?: string
): { url: URL; init: SearxngRequestInit } {
    const url = new URL(`${options.baseURL.replace(/\/$/, "")}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    if (options.maxResults != null) url.searchParams.set("count", String(options.maxResults));
    if (options.language && options.language !== "all") url.searchParams.set("language", options.language);

    return {
        url,
        init: {
            method: "GET",
            redirect: "follow",
            headers: {
                "user-agent": BROWSER_USER_AGENT,
                "x-forwarded-for": TRUSTED_FORWARDED_FOR,
                "accept": ACCEPT_HEADER,
                "accept-language": ACCEPT_LANGUAGE_HEADER,
                ...(apiKey !== undefined ? { authorization: `Bearer ${apiKey}` } : {})
            }
        }
    };
}
