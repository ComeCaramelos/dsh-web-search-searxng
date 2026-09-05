/**
 * Behavior spec for the host wiring: the plugin face, the settings projection,
 * and the option resolution that every search runs on.
 *
 * Nothing here drives a network: the provider is handed a source and the
 * resolution is read back through the seams it consults, so the precedence chain
 * — settings section → launch environment → constant — is observable without a
 * SearXNG instance behind it.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    Config,
    SEARXNG_DEFAULT_BASE_URL,
    SEARXNG_DEFAULT_MAX_RESULTS,
    SEARXNG_PROVIDER_ID,
    SETTINGS_NAMESPACE,
    apply,
    inject,
    name,
    resolveOptions
} from "../lib/index.js";

/**
 * A fake plugin context: the seams `apply` and the resolvers reach for.
 *
 * `inject(["settings"], …)` stands in for the optional settings dependency: it
 * hands the callback a context carrying a settings service that records what was
 * installed and attaches the entry config as the source, the way the real service
 * does, and keeps the hooks on itself so a test can flip the source from
 * underneath. `web` records the registration; `services` answers `ctx.get`.
 */
function fakeContext(services = {}) {
    const registrations = [];
    const sections = [];
    const hooks = { setSource: () => {}, onChange: () => {} };
    let settingsMounted = true;
    const ctx = {
        web: {
            registerSearchProvider(provider) {
                registrations.push(provider);
                return () => registrations.splice(registrations.indexOf(provider), 1);
            }
        },
        inject: (deps, callback) => {
            if (!deps.includes("settings") || !settingsMounted) return;
            callback({
                settings: {
                    installSection: (owner, ns, schema, entry, received) => {
                        sections.push({ owner, ns, schema, entry, received });
                        Object.assign(hooks, received);
                        hooks.setSource(() => entry);
                        hooks.onChange();
                    }
                }
            });
        },
        get(name, strict) {
            const found = services[name];
            if (found === undefined && strict) throw new Error(`no service ${name}`);
            return found;
        },
        /** Call before `apply` to model a composition without a settings provider. */
        withoutSettings() {
            settingsMounted = false;
        }
    };
    return { ctx, registrations, sections, hooks };
}

describe("plugin face", () => {
    it("names the web seam it injects into", () => {
        assert.equal(name, "web-search-searxng");
        assert.deepEqual([...inject], ["web"]);
    });

    it("keeps the namespace and the provider id fixed", () => {
        assert.equal(SETTINGS_NAMESPACE, "web-search-searxng");
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

    it("defaults every config field in the schema", () => {
        const resolved = Config({});
        assert.equal(resolved.baseURL, SEARXNG_DEFAULT_BASE_URL);
        assert.equal(resolved.maxResults, SEARXNG_DEFAULT_MAX_RESULTS);
        assert.equal(resolved.language, "all");
        assert.equal(resolved.apiKeyEnv, "SEARXNG_API_KEY");
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

    it("installs the settings section under this plugin's namespace, with the row config as the base", () => {
        const { ctx, sections } = fakeContext();
        apply(ctx, { baseURL: "http://localhost:8090" });
        assert.equal(sections.length, 1);
        assert.equal(sections[0].ns, SETTINGS_NAMESPACE);
        assert.deepEqual(sections[0].entry, { baseURL: "http://localhost:8090" });
    });

    it("reads the config source afresh per search", () => {
        const { ctx, registrations, hooks } = fakeContext();
        apply(ctx, { baseURL: "http://row.test" });
        const provider = registrations[0];
        // The settings service handed back a live source; flipping it stands in
        // for a GUI edit landing between searches. The provider must observe it,
        // never a snapshot taken at registration.
        hooks.setSource(() => ({ baseURL: "not a url", maxResults: 3 }));
        assert.equal(provider.available(), false);
        hooks.setSource(() => ({ baseURL: "http://second.test", maxResults: 7 }));
        assert.equal(provider.available(), true);
    });

    it("keeps working with no settings service mounted", () => {
        // No provider means the inject callback never fires: the source stays the
        // row config, and the registration still happens.
        const { ctx, registrations } = fakeContext();
        ctx.withoutSettings();
        apply(ctx, { baseURL: "http://localhost:8091" });
        assert.equal(registrations.length, 1);
        assert.equal(registrations[0].available(), true);
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
