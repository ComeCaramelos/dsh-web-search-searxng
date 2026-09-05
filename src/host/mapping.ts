/**
 * Host half — the SearXNG wire shape → the seam's normalized shape.
 *
 * The seam's contract is that a source always has a URL and its optional
 * fields exist only when the provider actually returned them: inventing a title
 * for a source SearXNG left bare would make the seam lie, and the tool layer
 * already renders `hostname(url)` for a title-less source. Entries without a URL
 * are therefore dropped, and every field is copied only when it is a non-empty
 * string.
 *
 * The result never carries `content`: the SearXNG search API returns no answer
 * text, only sources, and the seam owns `truncated`.
 */
import type { WebSearchResult, WebSearchSource } from "@deepseek-ai/dsh-web";

/** One entry of a SearXNG JSON API response, as delivered (nothing is trusted). */
export interface SearxngResponseEntry {
    url?: unknown;
    title?: unknown;
    content?: unknown;
    publishedDate?: unknown;
}

/** The response envelope the JSON API answers with. */
export interface SearxngResponseBody {
    results?: unknown;
    message?: unknown;
    error?: unknown;
}

/**
 * Map one SearXNG entry to a normalized source.
 * @param result - one entry, as delivered.
 * @returns the source, or `undefined` when the entry cannot be cited (no usable URL).
 */
export function mapSearxngResult(result: SearxngResponseEntry | undefined): WebSearchSource | undefined {
    const url = result?.url;
    if (!hasMeaning(url)) return undefined;
    const title = result?.title;
    const snippet = result?.content;
    const publishedAt = result?.publishedDate;
    const source: { url: string; title?: string; snippet?: string; publishedAt?: string } = { url };
    if (hasMeaning(title)) source.title = title;
    if (hasMeaning(snippet)) source.snippet = snippet;
    if (hasMeaning(publishedAt)) source.publishedAt = publishedAt;
    return source;
}

/**
 * Map a SearXNG response envelope to a normalized search result.
 *
 * Relevance order is preserved and the same URL is never cited twice: a
 * duplicated source inflates the source list without adding anything a caller
 * can act on.
 * @param response - the decoded body.
 * @returns the normalized result; `truncated` is the seam's business, so always `false` here.
 */
export function mapSearxngResponse(response: SearxngResponseBody | undefined): WebSearchResult {
    const sources: WebSearchSource[] = [];
    const seen = new Set<string>();
    const entries = Array.isArray(response?.results) ? (response?.results as SearxngResponseEntry[]) : [];
    for (const entry of entries) {
        const source = mapSearxngResult(entry);
        if (source === undefined || seen.has(source.url)) continue;
        seen.add(source.url);
        sources.push(source);
    }
    return { sources, truncated: false };
}

/** Whether a wire field carries anything worth citing: a string with real content. */
function hasMeaning(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}
