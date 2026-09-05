/**
 * @comecaramelos/dsh-web-search-searxng/provider — the provider without the row.
 *
 * The same pieces `apply` wires up, reachable without a plugin context: the
 * provider class over one option thunk, the SearXNG wire mapping, and the fixed
 * identifiers. A caller that drives its own config source — a test, a script
 * behind a proxy, a composition that resolves options its own way — composes
 * these and never imports the plugin's wiring.
 *
 * `new SearxngSearchProvider(() => options)` is the whole contract: a thunk
 * consulted afresh per search, never a cached snapshot, which is what lets a
 * settings edit reach the wire on the next search.
 *
 * The plugin's own wiring — the settings section, the precedence chain, the
 * credential resolution — is not here by design; reach for the root export when
 * you need that.
 */
export { SearxngSearchProvider } from "./host/provider.js";
export { mapSearxngResponse, mapSearxngResult } from "./host/mapping.js";
export type { SearxngResponseBody, SearxngResponseEntry } from "./host/mapping.js";
export {
    SEARXNG_DEFAULT_BASE_URL,
    SEARXNG_DEFAULT_LANGUAGE,
    SEARXNG_DEFAULT_MAX_RESULTS,
    SEARXNG_PROVIDER_ID
} from "./host/constants.js";
export type { SearxngSearchOptions, SearxngSearchRequestRecord } from "./host/types/search.js";
