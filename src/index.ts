/**
 * @comecaramelos/dsh-web-search-searxng — host half, public surface.
 *
 * Registers a SearXNG-backed search provider into the web capability seam
 * (`ctx.web`): one plain HTTP `GET` against the SearXNG JSON API
 * (`{baseURL}/search?format=json`), with the answers mapped onto the seam's
 * normalized `WebSearchSource` shape and every source the SearXNG API leaves
 * blank omitted rather than invented.
 *
 * It is a provider, not a tool: the tool the model actually calls is the
 * harness's own `dsh-tool-web`; this package only feeds the seam. Selecting it
 * instead of the shipped provider is a seam config (`web.config.searchProvider`,
 * see the bundled `cordis.patch.yml`), and the Web GUI's plugin card edits this
 * provider's settings namespace (see `./client`).
 *
 * Option precedence is fixed: settings user layer → launch environment variable
 * → constant. Every field arrives fully defaulted, so a row that states nothing
 * still drives a complete search against a local keyless SearXNG.
 *
 * Everything behind this surface lives in `./host/*`:
 *
 *   ./host/apply.ts       the wiring (section + provider)
 *   ./host/settings.ts    the namespace install + the live config source
 *   ./host/values.ts      precedence resolution: settings → env → constants
 *   ./host/credentials.ts the per-search API-key resolution
 *   ./host/recorder.ts    the secret-free session event for the request
 *   ./host/request.ts     the URL + headers one search dispatches with
 *   ./host/provider.ts    the provider class
 *   ./host/mapping.ts     SearXNG response → normalized sources
 *   ./host/abort.ts       cancellation, normalized to WEB_ABORTED
 *   ./host/constants.ts   fixed identifiers, defaults, header constants
 *   ./host/schema.ts      the row config schema
 *   ./host/types/         shared type sections (config, search, services)
 *
 * Config (cordis row), every field optional:
 *   baseURL      SearXNG base URL                 (default http://localhost:8080;
 *                                                 env SEARXNG_BASE_URL)
 *   maxResults   sources returned per search      (default 10; env SEARXNG_MAX_RESULTS)
 *   language     search language, "all" = unset   (default "all"; env SEARXNG_LANGUAGE)
 *   apiKey       literal key, never served back   (prefer apiKeyEnv)
 *   apiKeyEnv    credential reference per search  (default SEARXNG_API_KEY)
 */

// ── identity ────────────────────────────────────────────────────────────────
export { inject, name } from "./host/plugin-meta.js";

// ── fixed identifiers and defaults ──────────────────────────────────────────
export {
    DEFAULT_API_KEY_ENV,
    SEARXNG_BASE_URL_ENV,
    SEARXNG_DEFAULT_BASE_URL,
    SEARXNG_DEFAULT_LANGUAGE,
    SEARXNG_DEFAULT_MAX_RESULTS,
    SEARXNG_LANGUAGE_ENV,
    SEARXNG_MAX_RESULTS_ENV,
    SEARXNG_PROVIDER_ID,
    SETTINGS_NAMESPACE
} from "./host/constants.js";

// ── the row config schema, and the namespace the GUI edits ─────────────────
export { Config } from "./host/schema.js";

// ── the wiring ──────────────────────────────────────────────────────────────
export { apply } from "./host/apply.js";

// ── the provider, for reuse without the plugin row ──────────────────────────
export { SearxngSearchProvider } from "./host/provider.js";

// ── the behavior tests and diagnostics drive directly ───────────────────────
export { mapSearxngResponse, mapSearxngResult } from "./host/mapping.js";
export { buildSearchRequest } from "./host/request.js";
export { searchAborted, throwIfSearchAborted } from "./host/abort.js";
export { resolveOptions } from "./host/values.js";

// ── types ───────────────────────────────────────────────────────────────────
export type { SearxngSearchOptions, SearxngSearchRequestRecord } from "./host/types/search.js";
export type { SearxngResponseBody, SearxngResponseEntry } from "./host/mapping.js";
