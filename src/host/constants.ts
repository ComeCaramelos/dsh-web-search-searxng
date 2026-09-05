/**
 * Host half — fixed identifiers, defaults and request constants.
 *
 * Anything with a literal value the provider or the plugin row depends on lives
 * here, so a reader never has to grep the behavior modules for a magic string.
 * The defaults are the last rung of the precedence chain in
 * {@link ./values.ts resolveOptions}: settings user layer → environment
 * variable → the constants below.
 */

/** Stable provider id this plugin registers under in the web seam. */
export const SEARXNG_PROVIDER_ID = "searxng-local";

/** Namespace string the settings section installs under (branded in ./section.ts). */
export const SETTINGS_NAMESPACE = "web-search-searxng";

/** Cordis plugin name, used by loader diagnostics (see ./plugin-meta.ts). */
export const PLUGIN_NAME = "web-search-searxng";

/** Default SearXNG endpoint (the local compose deployment). */
export const SEARXNG_DEFAULT_BASE_URL = "http://localhost:8080";

/** Default upper bound on sources returned by one search. */
export const SEARXNG_DEFAULT_MAX_RESULTS = 10;

/** Default search language; "all" means "omit the parameter". */
export const SEARXNG_DEFAULT_LANGUAGE = "all";

/** Credential reference consulted when the config leaves `apiKeyEnv` unset. */
export const DEFAULT_API_KEY_ENV = "SEARXNG_API_KEY";

/** Environment fallbacks, read when the settings user layer leaves a field blank. */
export const SEARXNG_BASE_URL_ENV = "SEARXNG_BASE_URL";
export const SEARXNG_MAX_RESULTS_ENV = "SEARXNG_MAX_RESULTS";
export const SEARXNG_LANGUAGE_ENV = "SEARXNG_LANGUAGE";

/**
 * A real browser UA. SearXNG's limiter treats a missing or obviously scripted
 * UA as a bot signal, so the request would 429 far sooner. Keep this a
 * plausible desktop UA string.
 */
export const BROWSER_USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

/**
 * The host we claim. A local Docker deployment sees requests arrive from the
 * compose gateway address (e.g. `172.18.0.1`) and its limiter treats that as a
 * fresh client every time; with `trusted_proxies = ['127.0.0.0/8']` + `pass_ip`
 * in `limiter.toml` the forwarded localhost address keeps the JSON API usable.
 *
 * Do not drop this header for local instances — see the README's "Rate-limit
 * note". A remote SearXNG needs the same `trusted_proxies` allowance on the
 * server; the header is not adjusted per deployment from here.
 */
export const TRUSTED_FORWARDED_FOR = "127.0.0.1";

/** Accepted media types, preferring the JSON the parser reads. */
export const ACCEPT_HEADER = "application/json, text/html;q=0.9, */*;q=0.8";

/** Accept-language hint; harmless, and keeps the request from looking bare. */
export const ACCEPT_LANGUAGE_HEADER = "zh-CN,zh;q=0.9,en;q=0.8";
