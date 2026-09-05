/**
 * Host half — the plugin row's config schema.
 *
 * Everything is optional: every search resolves a value for every option (see
 * {@link ./values.ts values}), so a row that states nothing still gets a
 * complete option set and the provider never sees a missing value.
 *
 * Secret handling: `apiKey` carries `role("secret")` so it never rides a
 * `describe()`; prefer `apiKeyEnv`, which names a credential reference the seam
 * resolves for each search.
 */
import z from "@deepseek-ai/schemastery";
import {
    DEFAULT_API_KEY_ENV,
    SEARXNG_DEFAULT_BASE_URL,
    SEARXNG_DEFAULT_LANGUAGE,
    SEARXNG_DEFAULT_MAX_RESULTS
} from "./constants.js";

/** The plugin row's config: the validated shape of a `web-search-searxng` plugin
 * row, with every field optional because the defaults live in the resolution
 * chain. */
export interface Config {
    /** Literal SearXNG API key; optional for keyless instances. */
    apiKey?: string;
    /** Credential reference resolved for each search. Defaults to `SEARXNG_API_KEY`. */
    apiKeyEnv?: string;
    /** SearXNG base URL; `/search` is appended. Defaults to `http://localhost:8080`. */
    baseURL?: string;
    /** Upper bound on sources returned by one search. Defaults to 10. */
    maxResults?: number;
    /** Search language sent as `language=...`; "all" omits the parameter. */
    language?: string;
}

/**
 * The row config, every field defaulted.
 *
 * These defaults are the last rung of the precedence chain, so the row's
 * `!!js process.env.X ?? …` entries and the GUI's settings layer all land on the
 * same value.
 */
export const Config = z.object({
    apiKey: z.string().role("secret"),
    apiKeyEnv: z.string().role("credential-ref").default(DEFAULT_API_KEY_ENV),
    baseURL: z.string().default(SEARXNG_DEFAULT_BASE_URL),
    maxResults: z.number().step(1).min(1).default(SEARXNG_DEFAULT_MAX_RESULTS),
    language: z.string().default(SEARXNG_DEFAULT_LANGUAGE)
});
