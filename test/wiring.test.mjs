/**
 * Behavior spec for the host wiring: the plugin face, the configuration-form
 * surface, the live config source, and the option resolution that every search
 * runs on.
 *
 * Nothing here drives a network: the provider is handed a source and the
 * resolution is read back through the seams it consults, so the precedence chain
 * — configuration form → launch environment → constant — is observable without
 * a SearXNG instance behind it.
 *
 * The form surface is pinned from the *compiled* `Config` rather than from the
 * source, because the failure it guards against is invisible in the source: a
 * field the row page edits is reachable only when it is declared `.volatile()`.
 * An entry declaring no volatile field answers no form at all, and a write naming
 * a non-volatile field is refused Host-side — either one looks like a dead page.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    CONFIG_FIELDS,
    Config,
    ENTRY_ID,
    SEARXNG_DEFAULT_BASE_URL,
    SEARXNG_DEFAULT_MAX_RESULTS,
    SEARXNG_PROVIDER_ID,
    apply,
    configSource,
    inject,
    name,
    resolveOptions
} from "../lib/index.js";

/** A live reference the way a `.volatile()` field arrives: `get()` answers now. */
function live(value) {
    const ref = { value, get: () => ref.value };
    return ref;
}

/**
 * A fake plugin context: the seams `apply` and the resolvers reach for.
 *
 * `fiber.entry.options.id` is the profile entry id the form is keyed by;
 * `inject(["settings"], …)` stands in for the optional settings dependency and
 * hands the callback a settings service that records each `configure` call (the
 * auto page the card keeps off); `effect` runs its setup at once and keeps the
 * disposer; `web` records the registration; `services` answers `ctx.get`.
 */
function fakeContext(services = {}, { entryId = ENTRY_ID, settings = true } = {}) {
    const registrations = [];
    const configured = [];
    const disposers = [];
    const errors = [];
    const fiber = { entry: { options: entryId === null ? {} : { id: entryId } } };
    const service = {
        configure(presentation, owner) {
            configured.push({ presentation, owner });
            return () => configured.splice(configured.findIndex((entry) => entry.owner === owner), 1);
        },
        describe: () => [],
        mutate: async () => {}
    };
    const ctx = {
        fiber,
        web: {
            registerSearchProvider(provider) {
                registrations.push(provider);
                return () => registrations.splice(registrations.indexOf(provider), 1);
            }
        },
        effect(setup) {
            const dispose = setup();
            if (typeof dispose === "function") disposers.push(dispose);
        },
        inject(deps, callback) {
            if (!deps.includes("settings") || !settings) return;
            callback({ settings: service });
        },
        on() {
            return () => {};
        },
        logger: { error: (...args) => errors.push(args.join(" ")), warn: () => {} },
        get(name, strict) {
            const found = services[name];
            if (found === undefined && strict) throw new Error(`no service ${name}`);
            return found;
        }
    };
    const dispose = () => {
        for (const disposer of disposers.splice(0).reverse()) disposer();
    };
    return { ctx, registrations, configured, errors, fiber, dispose };
}

/** Field name → compiled field type, read out of the compiled form surface. */
function fieldTypes(config) {
    const compiled = config.toJSON();
    const refs = compiled.refs ?? {};
    const root = Object.values(refs).find((entry) => entry && typeof entry.dict === "object" && entry.dict !== null);
    assert.ok(root, "Config did not compile to a keyed shape");
    return new Map(Object.entries(root.dict).map(([field, ref]) => [field, refs[ref] ?? {}]));
}

describe("plugin face", () => {
    it("names the web seam it injects into", () => {
        assert.equal(name, "web-search-searxng");
        assert.deepEqual([...inject], ["web"]);
    });

    it("keeps the row's entry id and the provider id fixed", () => {
        assert.equal(ENTRY_ID, "web-search-searxng");
        assert.equal(SEARXNG_PROVIDER_ID, "searxng-local");
    });

    it("declares every config field optional", () => {
        // A row stating nothing must still resolve a complete option set.
        const { ctx } = fakeContext();
        apply(ctx, {});
        const options = resolveOptions(ctx, {});
        assert.equal(options.baseURL, SEARXNG_DEFAULT_BASE_URL);
        assert.equal(options.maxResults, SEARXNG_DEFAULT_MAX_RESULTS);
        assert.equal(options.language, "all");
        assert.equal(options.apiKey, undefined);
        assert.equal(options.apiKeyEnv, "SEARXNG_API_KEY");
    });
});

describe("the configuration form surface", () => {
    it("declares every user-authored field, and only those", () => {
        assert.deepEqual([...fieldTypes(Config).keys()].sort(), [...CONFIG_FIELDS].sort());
    });

    it("makes every field volatile, so the row page can edit it", () => {
        for (const [field, type] of fieldTypes(Config)) {
            assert.equal(type.meta?.volatile, true, `${field} must be .volatile()`);
        }
    });

    it("keeps the key a secret and its reference a credential reference", () => {
        const types = fieldTypes(Config);
        assert.equal(types.get("apiKey").meta.role, "secret");
        assert.equal(types.get("apiKeyEnv").meta.role, "credential-ref");
    });

    it("defaults only the credential reference, so blank fields reach the environment", () => {
        const values = configSource(Config({}))();
        assert.equal(values.apiKeyEnv, "SEARXNG_API_KEY");
        assert.equal(values.baseURL, undefined);
        assert.equal(values.maxResults, undefined);
        assert.equal(values.language, undefined);
        assert.equal(values.apiKey, undefined);
    });
});

describe("apply()", () => {
    it("registers one provider under the seam id", () => {
        const { ctx, registrations } = fakeContext();
        apply(ctx, { baseURL: "http://localhost:8090" });
        assert.equal(registrations.length, 1);
        assert.equal(registrations[0].id, SEARXNG_PROVIDER_ID);
        assert.equal(typeof registrations[0].available(), "boolean");
    });

    it("keeps the generated page off for this fiber, once, until the instance leaves", () => {
        const { ctx, configured, fiber, dispose } = fakeContext();
        apply(ctx, {});
        assert.equal(configured.length, 1);
        assert.deepEqual(configured[0].presentation, { auto: false });
        assert.equal(configured[0].owner, fiber);
        dispose();
        assert.equal(configured.length, 0, "the auto page comes back with the instance gone");
    });

    it("reads the live references afresh per search", () => {
        const { ctx, registrations } = fakeContext();
        const config = { baseURL: live("http://row.test"), maxResults: live(5) };
        apply(ctx, config);
        const provider = registrations[0];
        assert.equal(provider.available(), true);
        // A form commit moves the reference between searches; the provider must
        // observe it, never a snapshot taken at registration.
        config.baseURL.value = "not a url";
        assert.equal(provider.available(), false);
        config.baseURL.value = "http://second.test";
        config.maxResults.value = 7;
        assert.equal(provider.available(), true);
    });

    it("reads a plain value composed by hand as itself", () => {
        const { ctx, registrations } = fakeContext();
        apply(ctx, { baseURL: "not a url" });
        assert.equal(registrations[0].available(), false);
    });

    it("keeps working with no settings service mounted", () => {
        // No service means the inject callback never fires: the references keep
        // answering the row, and the registration still happens.
        const { ctx, registrations, configured } = fakeContext({}, { settings: false });
        apply(ctx, { baseURL: "http://localhost:8091" });
        assert.equal(registrations.length, 1);
        assert.equal(registrations[0].available(), true);
        assert.equal(configured.length, 0);
    });

    it("says so once, and still searches, when it was not started as a profile entry", () => {
        const { ctx, registrations, configured, errors } = fakeContext({}, { entryId: null });
        apply(ctx, {});
        assert.equal(errors.length, 1);
        assert.match(errors[0], /not a profile entry/);
        assert.equal(configured.length, 0, "no form to keep the page off for");
        assert.equal(registrations.length, 1);
    });
});

describe("resolveOptions()", () => {
    it("lets the launch environment fill a field the section leaves blank", () => {
        const environment = new Map([
            ["SEARXNG_BASE_URL", "http://from-env.test"],
            ["SEARXNG_MAX_RESULTS", "7"],
            ["SEARXNG_LANGUAGE", "pt"]
        ]);
        const { ctx } = fakeContext({
            launchEnvironment: { get: (key) => (environment.has(key) ? { value: environment.get(key) } : undefined) }
        });
        const options = resolveOptions(ctx, {});
        assert.equal(options.baseURL, "http://from-env.test");
        assert.equal(options.maxResults, 7);
        assert.equal(options.language, "pt");
    });

    it("prefers the section over the environment", () => {
        const environment = new Map([["SEARXNG_BASE_URL", "http://from-env.test"]]);
        const { ctx } = fakeContext({
            launchEnvironment: { get: (key) => (environment.has(key) ? { value: environment.get(key) } : undefined) }
        });
        const options = resolveOptions(ctx, { baseURL: "http://from-section.test" });
        assert.equal(options.baseURL, "http://from-section.test");
    });

    it("ignores a blank environment value", () => {
        const { ctx } = fakeContext({
            launchEnvironment: { get: () => ({ value: "" }) }
        });
        assert.equal(resolveOptions(ctx, {}).baseURL, SEARXNG_DEFAULT_BASE_URL);
    });

    it("falls back to the constant when an environment bound is not a positive integer", () => {
        const environment = new Map([["SEARXNG_MAX_RESULTS", "many"]]);
        const { ctx } = fakeContext({
            launchEnvironment: { get: (key) => (environment.has(key) ? { value: environment.get(key) } : undefined) }
        });
        assert.equal(resolveOptions(ctx, {}).maxResults, SEARXNG_DEFAULT_MAX_RESULTS);
    });

    it("resolves the key through the credentials domain when one is mounted", async () => {
        const resolved = [];
        const { ctx } = fakeContext({
            credentials: {
                resolve: async (ref) => {
                    resolved.push(ref);
                    return { value: "sxng-key" };
                }
            }
        });
        const options = resolveOptions(ctx, {});
        assert.equal(options.apiKeyEnv, "SEARXNG_API_KEY");
        assert.equal(await options.resolveApiKey(), "sxng-key");
        assert.deepEqual(resolved, ["SEARXNG_API_KEY"]);
    });

    it("resolves the key through the environment when no domain is mounted", async () => {
        const environment = new Map([["SEARXNG_API_KEY", "from-env"]]);
        const { ctx } = fakeContext({
            launchEnvironment: { get: (key) => (environment.has(key) ? { value: environment.get(key) } : undefined) }
        });
        const options = resolveOptions(ctx, {});
        assert.equal(await options.resolveApiKey(), "from-env");
    });

    it("honours the reference the section names", async () => {
        const resolved = [];
        const { ctx } = fakeContext({
            credentials: {
                resolve: async (ref) => {
                    resolved.push(ref);
                    return undefined;
                }
            }
        });
        const options = resolveOptions(ctx, { apiKeyEnv: "OTHER_REF" });
        assert.equal(options.apiKeyEnv, "OTHER_REF");
        await options.resolveApiKey();
        assert.deepEqual(resolved, ["OTHER_REF"]);
    });

    it("treats an empty literal key as no key", () => {
        const { ctx } = fakeContext();
        assert.equal(resolveOptions(ctx, { apiKey: "" }).apiKey, undefined);
    });

    it("records the request on the initiating Agent's session", () => {
        const appended = [];
        const { ctx } = fakeContext({
            agents: {
                currentInitiator: () => ({
                    session: { append: (type, payload) => appended.push([type, payload]) }
                })
            }
        });
        resolveOptions(ctx, {}).recordRequest?.({ endpoint: "https://sxng.test/search?q=a", query: "a" });
        assert.deepEqual(appended, [["web/searxng-search-request", { endpoint: "https://sxng.test/search?q=a", query: "a" }]]);
    });

    it("records nothing when no Agent initiated the search", () => {
        const appended = [];
        const { ctx } = fakeContext({
            agents: {
                currentInitiator: () => undefined
            }
        });
        resolveOptions(ctx, {}).recordRequest?.({ endpoint: "https://sxng.test/search?q=a", query: "a" });
        assert.deepEqual(appended, []);
    });
});
