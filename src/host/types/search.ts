/**
 * Host half — the resolved option set one search is served from, plus the
 * request-recorder face.
 *
 * These are the internal contract between {@link ./values.ts values} (which
 * resolves settings → environment → defaults) and
 * {@link ./provider.ts provider} (which never sees a missing value). Keep them
 * fully populated: a field the seam has to guess at is a field a provider
 * cannot honor.
 */

/** The fully resolved options one search runs on. */
export interface SearxngSearchOptions {
    /** Literal API key when configured; absent for a keyless instance. */
    readonly apiKey?: string;
    /** Resolver for the configured credential reference. */
    readonly resolveApiKey: () => Promise<string | undefined>;
    /** Credential reference name, for diagnostics and the recorded request. */
    readonly apiKeyEnv: string;
    /** SearXNG base URL; `/search` is appended. */
    readonly baseURL: string;
    /** Upper bound on sources returned by one search. */
    readonly maxResults: number;
    /** Search language sent as `language=...`; "all" omits the parameter. */
    readonly language: string;
    /** Recorder for the exact secret-free request about to leave. */
    readonly recordRequest?: (request: SearxngSearchRequestRecord) => void;
}

/**
 * The exact search request recorded before one dispatch.
 *
 * Secret-free by construction: only the endpoint and the query travel. The
 * credential rides the request headers and is never part of the record.
 */
export interface SearxngSearchRequestRecord {
    /** Fully resolved search endpoint. */
    readonly endpoint: string;
    /** The query sent. */
    readonly query: string;
}
