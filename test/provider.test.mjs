/**
 * Behavior spec for the SearXNG-backed search provider.
 *
 * The provider's contract with the seam, driven through the public `./provider`
 * surface: what a search sends on the wire, what it hands back, and how every
 * failure and every cancellation is reported.
 *
 * Zero dependencies: Node's own test runner, and `globalThis.fetch` stubbed for
 * the duration of each case that reaches the network.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
    SEARXNG_DEFAULT_BASE_URL,
    SEARXNG_DEFAULT_MAX_RESULTS,
    SEARXNG_PROVIDER_ID,
    SearxngSearchProvider,
    mapSearxngResponse,
    mapSearxngResult
} from "../lib/provider.js";

const options = { baseURL: "https://searxng.test", maxResults: 5, language: "all" };

/** Wrap options in the thunk the provider snapshots per search. */
function provider(opts = options) {
    return new SearxngSearchProvider(() => opts);
}

function jsonResponse(body, init = {}) {
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
}

let originalFetch;
beforeEach(() => {
    originalFetch = globalThis.fetch;
});
afterEach(() => {
    globalThis.fetch = originalFetch;
});

describe("mapSearxngResult", () => {
    it("maps a full result entry", () => {
        assert.deepEqual(
            mapSearxngResult({ url: "https://a.test", title: "A", content: "snippet text", publishedDate: "2026-01-01" }),
            { url: "https://a.test", title: "A", snippet: "snippet text", publishedAt: "2026-01-01" }
        );
    });

    it("drops a result with no URL (uncitable)", () => {
        assert.equal(mapSearxngResult({ url: "", title: "no url" }), undefined);
        assert.equal(mapSearxngResult(undefined), undefined);
        assert.equal(mapSearxngResult({ title: "no url field" }), undefined);
    });

    it("omits blank snippet rather than inventing one", () => {
        assert.deepEqual(mapSearxngResult({ url: "https://a.test", title: "A", content: "   " }), {
            url: "https://a.test",
            title: "A"
        });
    });

    it("omits missing publishedAt", () => {
        assert.deepEqual(mapSearxngResult({ url: "https://a.test" }), { url: "https://a.test" });
    });
});

describe("mapSearxngResponse", () => {
    it("maps a full envelope preserving order", () => {
        const result = mapSearxngResponse({
            results: [
                { url: "https://a.test", title: "A" },
                { url: "https://b.test", title: "B", content: "snippet" }
            ]
        });
        assert.deepEqual(
            result.sources.map((source) => source.url),
            ["https://a.test", "https://b.test"]
        );
        assert.equal(result.truncated, false);
    });

    it("dedupes by URL", () => {
        const result = mapSearxngResponse({
            results: [
                { url: "https://a.test", title: "A" },
                { url: "https://a.test", title: "A again" }
            ]
        });
        assert.equal(result.sources.length, 1);
    });

    it("tolerates a missing or malformed results array", () => {
        assert.deepEqual(mapSearxngResponse(undefined).sources, []);
        assert.deepEqual(mapSearxngResponse({}).sources, []);
        assert.deepEqual(mapSearxngResponse({ results: "not-an-array" }).sources, []);
    });
});

describe("SearxngSearchProvider", () => {
    it("exposes the stable provider id", () => {
        assert.equal(provider().id, SEARXNG_PROVIDER_ID);
        assert.equal(SEARXNG_PROVIDER_ID, "searxng-local");
    });

    it("is available when baseURL parses and maxResults is positive", () => {
        assert.equal(provider().available(), true);
        assert.equal(provider({ ...options, baseURL: "not a url" }).available(), false);
        assert.equal(provider({ ...options, maxResults: 0 }).available(), false);
    });

    it("defaults match the documented constants", () => {
        assert.equal(SEARXNG_DEFAULT_BASE_URL, "http://localhost:8080");
        assert.equal(SEARXNG_DEFAULT_MAX_RESULTS, 10);
    });

    it("sends q, format=json and count, and maps the response", async () => {
        globalThis.fetch = async (url) => {
            const target = new URL(String(url));
            assert.equal(target.pathname, "/search");
            assert.equal(target.searchParams.get("q"), "deepseek");
            assert.equal(target.searchParams.get("format"), "json");
            assert.equal(target.searchParams.get("count"), "5");
            return jsonResponse({ results: [{ url: "https://a.test", title: "A", content: "snip" }] });
        };
        const result = await provider().search({ query: "deepseek" });
        assert.deepEqual(result.sources, [{ url: "https://a.test", title: "A", snippet: "snip" }]);
    });

    it("sends the language parameter when configured (not 'all')", async () => {
        globalThis.fetch = async (url) => {
            const target = new URL(String(url));
            assert.equal(target.searchParams.get("language"), "en");
            return jsonResponse({ results: [] });
        };
        await provider({ ...options, language: "en" }).search({ query: "q" });
    });

    it("omits the language parameter when 'all' or unset", async () => {
        globalThis.fetch = async (url) => {
            const target = new URL(String(url));
            assert.equal(target.searchParams.has("language"), false);
            return jsonResponse({ results: [] });
        };
        await provider({ ...options, language: "all" }).search({ query: "q" });
        await provider({ ...options, language: undefined }).search({ query: "q" });
    });

    it("records the request it is about to send", async () => {
        const records = [];
        globalThis.fetch = async () => jsonResponse({ results: [] });
        await provider({
            ...options,
            recordRequest: (record) => records.push(record)
        }).search({ query: "deepseek" });
        assert.equal(records.length, 1);
        assert.equal(records[0].query, "deepseek");
        assert.match(records[0].endpoint, /^https:\/\/searxng\.test\/search\?/);
    });

    it("sends the trusted X-Forwarded-For header (Docker-gateway rate-limit bypass)", async () => {
        globalThis.fetch = async (_url, init) => {
            const headers = new Headers(init?.headers);
            assert.equal(headers.get("x-forwarded-for"), "127.0.0.1");
            return jsonResponse({ results: [] });
        };
        await provider().search({ query: "q" });
    });

    it("authorizes with a configured key", async () => {
        globalThis.fetch = async (_url, init) => {
            const headers = new Headers(init?.headers);
            assert.equal(headers.get("authorization"), "Bearer sxng-key");
            return jsonResponse({ results: [] });
        };
        await provider({ ...options, apiKey: "sxng-key" }).search({ query: "q" });
    });

    it("resolves the key per search when configured by reference", async () => {
        let resolutions = 0;
        globalThis.fetch = async (_url, init) => {
            const headers = new Headers(init?.headers);
            assert.equal(headers.get("authorization"), "Bearer rotated");
            return jsonResponse({ results: [] });
        };
        const resolveApiKey = async () => {
            resolutions += 1;
            return "rotated";
        };
        await provider({ ...options, resolveApiKey }).search({ query: "a" });
        await provider({ ...options, resolveApiKey }).search({ query: "b" });
        assert.equal(resolutions, 2);
    });

    it("sends no authorization header when no key resolves", async () => {
        globalThis.fetch = async (_url, init) => {
            const headers = new Headers(init?.headers);
            assert.equal(headers.has("authorization"), false);
            return jsonResponse({ results: [] });
        };
        await provider({ ...options, resolveApiKey: async () => undefined }).search({ query: "q" });
    });

    it("reports a failing credential resolution as WEB_PROVIDER_ERROR", async () => {
        globalThis.fetch = async () => jsonResponse({ results: [] });
        await assert.rejects(
            provider({ ...options, resolveApiKey: async () => {
                throw new Error("credential store down");
            } }).search({ query: "q" }),
            (error) => error.code === "WEB_PROVIDER_ERROR"
        );
    });

    it("propagates non-2xx as WEB_PROVIDER_ERROR with the API message", async () => {
        globalThis.fetch = async () => new Response(JSON.stringify({ message: "rate limited" }), { status: 429 });
        await assert.rejects(provider().search({ query: "q" }), (error) => error.code === "WEB_PROVIDER_ERROR");
    });

    it("propagates network failure as WEB_PROVIDER_ERROR", async () => {
        globalThis.fetch = async () => {
            throw new TypeError("fetch failed");
        };
        await assert.rejects(provider().search({ query: "q" }), (error) => error.code === "WEB_PROVIDER_ERROR");
    });

    it("reports an unprocessable body as WEB_PROVIDER_ERROR", async () => {
        globalThis.fetch = async () => new Response("<html>not json</html>", { status: 200 });
        await assert.rejects(provider().search({ query: "q" }), (error) => error.code === "WEB_PROVIDER_ERROR");
    });

    it("honors an already-aborted signal as WEB_ABORTED", async () => {
        const controller = new AbortController();
        controller.abort();
        await assert.rejects(provider().search({ query: "q" }, controller.signal), (error) => error.code === "WEB_ABORTED");
    });

    it("reports an abort during the credential read as WEB_ABORTED", async () => {
        const controller = new AbortController();
        globalThis.fetch = async () => jsonResponse({ results: [] });
        const searching = provider({
            ...options,
            resolveApiKey: () => {
                controller.abort();
                return new Promise(() => {});
            }
        }).search({ query: "q" }, controller.signal);
        await assert.rejects(searching, (error) => error.code === "WEB_ABORTED");
    });

    it("never invents answer text and never claims truncation", async () => {
        globalThis.fetch = async () => jsonResponse({ results: [{ url: "https://a.test", title: "A" }] });
        const result = await provider().search({ query: "q", maxResults: 1 });
        assert.equal("content" in result, false, "SearXNG returns no answer text");
        assert.equal(result.truncated, false, "the seam owns truncation");
    });
});
