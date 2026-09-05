/**
 * Host half — the shared type sections, re-exported as one surface.
 *
 * `index.ts` is the import any module outside `./types/` reaches for; a section
 * stays its own file so a reader can tell config shape from request shape from
 * service shape without scrolling one long file.
 */
export type { Config } from "./config.js";
export type { SearxngSearchOptions, SearxngSearchRequestRecord } from "./search.js";
export type { AgentSessionOwner, CredentialsAccessor, EnvironmentAccessor, PluginContext } from "./services.js";
