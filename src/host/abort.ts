/**
 * Host half — cancellation, normalized.
 *
 * The seam asks one thing of a provider that is interrupted: every abort surfaces
 * as a `WEB_ABORTED`, whichever shape the interruption arrived in. A caller that
 * cancels is not a failure, and a provider that reports "fetch failed" on a cancel
 * would be classified as a provider error by the seam's own diagnostics.
 *
 * Three routes a cancellation reaches the provider by, all handled here:
 *
 *   - the signal is already aborted before any work starts
 *     ({@link throwIfSearchAborted});
 *   - the fetch itself rejects with an `AbortError`;
 *   - an awaited helper — the credential read — is still running when the abort
 *     lands: {@link abortable} turns that into the same `WEB_ABORTED` instead of
 *     a rejection the caller cannot classify.
 */
import { WebError } from "@deepseek-ai/dsh-web";

/** The provider's own "this search stopped" error, chaining the caller's reason. */
export function searchAborted(signal?: AbortSignal, fallback?: unknown): WebError {
    return new WebError("SearXNG search aborted", "WEB_ABORTED", {
        cause: signal?.aborted ? signal.reason : fallback
    });
}

/** Stop here, now, when the caller has already asked to stop. */
export function throwIfSearchAborted(signal?: AbortSignal): void {
    if (signal?.aborted) throw searchAborted(signal);
}

/** Whether a rejection is the platform's cancellation signal rather than a failure. */
export function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Await `operation` but let `signal` win the race: whichever settles first
 * decides the result, and an abort arrives as {@link searchAborted} rather than
 * as whatever the pending operation would eventually have rejected with.
 */
export function abortable<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal === undefined) return operation;
    if (signal.aborted) return Promise.reject(searchAborted(signal));
    return new Promise<T>((resolve, reject) => {
        const onAbort = (): void => reject(searchAborted(signal));
        signal.addEventListener("abort", onAbort, { once: true });
        operation.then(
            (value) => {
                signal.removeEventListener("abort", onAbort);
                resolve(value);
            },
            (error: unknown) => {
                signal.removeEventListener("abort", onAbort);
                // Strip the constructor's prefix so the message the caller sees is
                // the original rejection's, with the original kept as `cause`.
                reject(new Error(String(error).replace(/^Error: /u, ""), { cause: error }));
            }
        );
    });
}
