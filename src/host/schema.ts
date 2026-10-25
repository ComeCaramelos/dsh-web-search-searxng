/**
 * Host half — the plugin row's config schema.
 *
 * Since dsh 0.2 this one `Config` is also the row's configuration form: the
 * Plugins page edits the bundle row's own configuration, served keyed by the
 * row's profile entry id, with the profile patch as its user layer. A field the
 * page edits is reachable only when it is declared `.volatile()`: an entry with
 * no volatile field answers no form at all (`Plugin entry "<id>" has no
 * volatile fields`), and a write naming a non-volatile field is refused
 * (`Config field "<path>" is not volatile`). Every field here is therefore
 * volatile, and `apply` receives each one as a live reference read afresh per
 * search (see {@link ./settings.ts readConfig}).
 *
 * `baseURL`, `maxResults` and `language` carry no schema default on purpose: a
 * field the form leaves blank must fall through to the launch environment
 * (`SEARXNG_*`) before the constant, and a schema default would answer first
 * and hide the environment for good. The chain lives in {@link ./values.ts
 * values}; the provider still never sees a missing value.
 *
 * Secret handling: `apiKey` carries `role("secret")` so it never rides a
 * `describe()`; prefer `apiKeyEnv`, which names a credential reference the seam
 * resolves for each search.
 */
import z from "@deepseek-ai/schemastery";
import { DEFAULT_API_KEY_ENV } from "./constants.js";

/** The plain values one read of the row config answers, every field optional
 * because the defaults live in the resolution chain. */
export interface ConfigValues {
    /** Literal SearXNG API key; optional for keyless instances. */
    apiKey?: string;
    /** Credential reference resolved for each search. Defaults to `SEARXNG_API_KEY`. */
    apiKeyEnv?: string;
    /** SearXNG base URL; `/search` is appended. Blank → `SEARXNG_BASE_URL` → `http://localhost:8080`. */
    baseURL?: string;
    /** Upper bound on sources returned by one search. Blank → `SEARXNG_MAX_RESULTS` → 10. */
    maxResults?: number;
    /** Search language sent as `language=...`; "all" omits the parameter. Blank → `SEARXNG_LANGUAGE` → "all". */
    language?: string;
}

/** The row config as `apply` receives it: each field a live (volatile)
 * reference, or — composed by hand, in a test or a script — a plain value. */
export type Config = {
    [K in keyof ConfigValues]?: ConfigValues[K] | { get(): ConfigValues[K] | undefined };
};

/** The row config / configuration form, every field volatile. */
export const Config = z.object({
    apiKey: z.string().role("secret").volatile(),
    apiKeyEnv: z.string().role("credential-ref").default(DEFAULT_API_KEY_ENV).volatile(),
    baseURL: z.string().volatile(),
    maxResults: z.number().step(1).min(1).volatile(),
    language: z.string().volatile()
});
