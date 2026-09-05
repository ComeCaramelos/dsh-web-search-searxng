/**
 * Host half — the provider itself: one SearXNG instance, one search.
 *
 * The class is a thin driver: it takes an option thunk, and each search
 * resolves the request, dispatches it and maps the answer. Two rules hold it
 * together:
 *
 *   - An option snapshot taken on entry. A settings change mid-search applies to
 *     the *next* search, never to the one already on the wire.
 *   - `available()` never touches the network: it only judges what the config
 *     itself claims, because the seam calls it to choose between providers, and
 *     a check that reaches out would turn a selection into a request.
 *
 * The wire details live behind it: request construction in
 * {@link ./request.ts request}, result mapping in {@link ./mapping.ts mapping},
 * cancellation in {@link ./abort.ts abort}.
 */
import { WebError } from "@deepseek-ai/dsh-web";
import type { WebSearchProvider, WebSearchRequest, WebSearchResult } from "@deepseek-ai/dsh-web";
import { isAbortError, searchAborted, throwIfSearchAborted, abortable } from "./abort.js";
import { SEARXNG_PROVIDER_ID } from "./constants.js";
import { mapSearxngResponse } from "./mapping.js";
import { buildSearchRequest } from "./request.js";
import type { SearxngSearchOptions } from "./types/index.js";

/** A SearXNG-backed search provider. */
export class SearxngSearchProvider implements WebSearchProvider {
    /** The stable id this provider registers under. */
    readonly id = SEARXNG_PROVIDER_ID;

    /** Source of the option set every search runs on. */
    private readonly source: () => SearxngSearchOptions;

    /**
     * @param source - resolver of the current options, consulted afresh per search.
     */
    constructor(source: () => SearxngSearchOptions) {
        this.source = source;
    }

    /** A purely local usability check: a parseable endpoint and a usable bound. */
    available(): boolean {
        const options = this.source();
        return URL.canParse(options.baseURL) && Number.isInteger(options.maxResults) && options.maxResults > 0;
    }

    /**
     * Run one search.
     * @param request - the query to send.
     * @param signal - cancellation; every abort surfaces as `WEB_ABORTED`.
     * @returns the normalized sources; never answer text, which SearXNG does not produce.
     */
    async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
        const options = this.source();
        throwIfSearchAborted(signal);
        const apiKey = await this.resolveKey(options, signal);
        throwIfSearchAborted(signal);

        const { url, init } = buildSearchRequest(options, request.query, apiKey);
        options.recordRequest?.({ endpoint: url.toString(), query: request.query });

        let response: Awaited<ReturnType<typeof fetch>>;
        try {
            response = await fetch(url, { ...init, ...(signal !== undefined ? { signal } : {}) });
        } catch (error) {
            if (signal?.aborted || isAbortError(error)) throw searchAborted(signal, error);
            throw new WebError(`SearXNG search request failed: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
        }

        if (!response.ok) throw await apiError(response);

        try {
            return mapSearxngResponse(await response.json());
        } catch (error) {
            if (signal?.aborted || isAbortError(error)) throw searchAborted(signal, error);
            if (error instanceof WebError) throw error;
            throw new WebError(`SearXNG returned an unprocessable response body: ${String(error)}`, "WEB_PROVIDER_ERROR", {
                cause: error
            });
        }
    }

    /**
     * The key to authorize with, resolved now rather than cached: a rotated
     * credential must reach the very next search.
     */
    private async resolveKey(options: SearxngSearchOptions, signal?: AbortSignal): Promise<string | undefined> {
        throwIfSearchAborted(signal);
        if (options.apiKey !== undefined) return options.apiKey;
        try {
            const resolved = await abortable(options.resolveApiKey?.() ?? Promise.resolve(undefined), signal);
            return resolved || undefined;
        } catch (error) {
            if (signal?.aborted || isAbortError(error)) throw searchAborted(signal, error);
            throw new WebError(`SearXNG credential resolution failed: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
        }
    }
}

/**
 * A non-2xx answer: SearXNG reports its own reason in the JSON body, and that
 * reason is a far better report than the status code alone. A body that is not
 * JSON — the reverse proxy's HTML error page — falls back to the status line.
 */
async function apiError(response: Response): Promise<WebError> {
    const status = `SearXNG API error (HTTP ${response.status})`;
    try {
        const body = (await response.json()) as { message?: unknown; error?: unknown };
        const detail = typeof body?.message === "string" ? body.message : body?.error;
        if (typeof detail === "string" && detail.trim().length > 0) return new WebError(detail, "WEB_PROVIDER_ERROR");
    } catch {
        /* non-JSON error body */
    }
    return new WebError(status, "WEB_PROVIDER_ERROR");
}
