/**
 * Behavior spec for the emitted browser bundle.
 *
 * Materializes `lib/client.js` through the same `window.__ModuleLoader__.load`
 * contract the shell's module system uses, with the real React behind the
 * `react` seed words, and drives the configuration card on the bundle's page through it: the
 * module edges it requires, the one `plugins.bundle.config` registration, the
 * shapes the Plugins page asks for, the staged form and what a save writes —
 * including the key, which goes through the credentials domain and never
 * through the form.
 *
 * The card machinery itself (controller, write passes, registration order) is
 * `@comecaramelos/dsh-ancesters`' own test suite; what stays here is this row's
 * descriptor and the doors its body composes over the shared controller.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const requireCjs = createRequire(import.meta.url);
const React = requireCjs("react");
const { renderToString } = requireCjs("react-dom/server");

const here = dirname(fileURLToPath(import.meta.url));
const bundlePath = join(here, "..", "lib", "client.js");
const BUNDLE_ID = "@comecaramelos/dsh-web-search-searxng";
const ENTRY_ID = "web-search-searxng";
/** The only module edges the bundle may require: the platform seed words. */
const SEED_WORDS = ["react", "react/jsx-runtime", "@deepseek-ai/dsh-client-store", "@deepseek-ai/dsh-client-ui-primitives"];

/** Flush pending microtasks and one macrotask: credential reads settle there. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

/** A minimal snapshot store standing in for dsh-client-store's factory. */
function createSnapshotStore(initial) {
    let state = initial;
    const listeners = new Set();
    return {
        getSnapshot: () => state,
        subscribe: (notify) => {
            listeners.add(notify);
            return () => listeners.delete(notify);
        },
        set: (next) => {
            state = next;
            for (const notify of [...listeners]) notify();
        }
    };
}

/** Evaluate the bundle once and return its face plus the edges it required. */
function loadBundle() {
    const pending = [];
    const required = [];
    const previous = globalThis.window;
    globalThis.window = { __ModuleLoader__: { load: (registration) => pending.push(registration) } };
    try {
        vm.runInThisContext(readFileSync(bundlePath, "utf8"), { filename: "client.js" });
    } finally {
        globalThis.window = previous;
    }
    assert.equal(pending.length, 1, "the bundle registers exactly one factory");
    assert.equal(pending[0].id, BUNDLE_ID);
    const exports = pending[0].factory((specifier) => {
        required.push(specifier);
        switch (specifier) {
            case "react":
                return React;
            case "react/jsx-runtime":
                return requireCjs("react/jsx-runtime");
            case "@deepseek-ai/dsh-client-store":
                return { createSnapshotStore };
            case "@deepseek-ai/dsh-client-ui-primitives":
                return { Menu: () => null, Switch: () => null };
            default:
                throw new Error(`the bundle requires a specifier the module table cannot answer: ${specifier}`);
        }
    });
    return { exports, required };
}

const { exports: bundle, required } = loadBundle();

/**
 * A mutable fake configuration form — the surface the browser half reads and
 * writes through since dsh 0.2: `getSnapshot()` (whose `user` layer answers the
 * Overridden badge), `subscribe()` for live pushes, and `mutate(ops)` as the one
 * write door. Every accepted write advances the revision the way the real
 * form's fence does; `refuse` makes the next writes answer `false`.
 */
function makeForm({ user = {}, base = {}, writable = true } = {}) {
    const form = {
        writes: [],
        refuse: false,
        listeners: new Set(),
        state: { status: "ready", value: { apiKeyEnv: "SEARXNG_API_KEY", ...base, ...user }, user: { ...user }, revision: 1, writable },
        getSnapshot() {
            return this.state;
        },
        subscribe(listener) {
            this.listeners.add(listener);
            return () => this.listeners.delete(listener);
        },
        async mutate(ops) {
            if (this.refuse) return false;
            const value = { ...this.state.value };
            const user = { ...this.state.user };
            for (const op of ops) {
                const field = op.path[0];
                this.writes.push(op.op === "unset" ? ["unset", field] : ["set", field, op.value]);
                if (op.op === "unset") {
                    delete user[field];
                    if (field in base) value[field] = base[field];
                    else delete value[field];
                } else {
                    value[field] = op.value;
                    user[field] = op.value;
                }
            }
            this.state = { ...this.state, value, user, revision: this.state.revision + 1 };
            for (const listener of [...this.listeners]) listener();
            return true;
        },
        /** A Host-side change (another tab, a patch edit). */
        advance(patch) {
            this.state = { ...this.state, ...patch, revision: this.state.revision + 1 };
            for (const listener of [...this.listeners]) listener();
        }
    };
    return form;
}

/** A fake credentials domain: `describe` answers what `set` stored. */
function makeCredentials({ stored = {}, refuse = false } = {}) {
    const credentials = {
        sets: [],
        described: [],
        stored: { ...stored },
        async describe(refs) {
            credentials.described.push([...refs]);
            const value = {};
            for (const ref of refs) value[ref] = { configured: credentials.stored[ref] !== undefined, writable: true };
            return { ok: true, value };
        },
        async set(ref, secret) {
            credentials.sets.push([ref, secret]);
            if (refuse) throw new Error("refused");
            credentials.stored[ref] = secret;
        }
    };
    return credentials;
}

/** Mount the bundle against fake shell services, the way the loader does. */
function setup({ form = makeForm(), credentials = makeCredentials() } = {}) {
    const registrations = [];
    const injected = [];
    const served = [];
    const locale = {
        registered: [],
        register(ns, dicts) {
            locale.registered.push({ ns, dicts });
            return () => {};
        },
        bind(ns) {
            return (key) => {
                const entry = locale.registered.find((registered) => registered.ns === ns);
                return entry?.dicts.en?.[key] ?? key;
            };
        }
    };
    const handlers = new Map();
    const disposers = [];
    const ctx = {
        locale,
        configForms: {
            get(entryId) {
                served.push(entryId);
                return form;
            }
        },
        slots: {
            inject(name, register) {
                injected.push(name);
                register();
                return () => {};
            },
            register(entry, component) {
                registrations.push({ entry, component });
                return () => {};
            }
        },
        remote: {
            credentials,
            $on(event, handler) {
                handlers.set(event, handler);
                return () => handlers.delete(event);
            }
        },
        effect(setupEffect) {
            const dispose = setupEffect();
            if (typeof dispose === "function") disposers.push(dispose);
        }
    };
    bundle.apply(ctx);
    const registration = registrations.find((entry) => entry.entry.name === "plugins.bundle.config");
    const face = registration?.entry.inject();
    return {
        ctx,
        form,
        credentials,
        registrations,
        injected,
        served,
        locale,
        handlers,
        controller: face?.controller,
        /** The key controller `apply` built, once its mount-time read settled. */
        async keys() {
            await flush();
            return bundle.keyControllerOf(ctx);
        },
        render(view = "page") {
            return renderToString(React.createElement(registration.component, { view, form: undefined }));
        },
        dispose() {
            for (const dispose of disposers.splice(0).reverse()) dispose();
        }
    };
}

describe("the bundle", () => {
    it("requires only the platform seed words", () => {
        assert.deepEqual([...new Set(required)].sort(), [...SEED_WORDS].sort());
    });

    it("exports the loader surface", () => {
        assert.equal(typeof bundle.apply, "function");
        // The card's own set (dsh-ancesters), then the credentials domain the key control writes through.
        assert.deepEqual([...bundle.inject], ["configForms", "slots", "locale", "remote", "remote.settings", "remote.credentials"]);
    });
});

describe("the bundle's configuration page", () => {
    it("registers once, under plugins.bundle.config, on the bundle's own page", () => {
        const env = setup();
        // The Plugins list opens the bundle's page with the form on it, like
        // the built-in Web search entry — never one step further in, on the row.
        assert.deepEqual(env.registrations.map((entry) => entry.entry.name), ["plugins.bundle.config"]);
        const { entry } = env.registrations[0];
        // Keyed by the bundle package name (this plugin is its own bundle).
        assert.equal(entry.key, BUNDLE_ID);
        assert.equal(entry.locale, "web-search-searxng");
        // Every read and write goes through the row's entry id.
        assert.deepEqual([...new Set(env.served)], [ENTRY_ID]);
        env.dispose();
    });

    it("shadows nothing: the shipped DeepSeek page keeps its own entry", () => {
        const env = setup();
        assert.ok(!env.injected.includes("settings.plugin.item"));
        assert.ok(!env.injected.includes("plugins.item"));
        env.dispose();
    });

    it("registers its dictionaries under the ids dsh declares", () => {
        const env = setup();
        const entry = env.locale.registered.find((registered) => registered.ns === "web-search-searxng");
        assert.ok(entry, "the plugin namespace is registered");
        assert.ok(entry.dicts.en && entry.dicts.zh, "en and zh are registered");
        assert.ok(!("en-US" in entry.dicts), "a dictionary under en-US is never read");
        // This plugin's own keys (merged over the shared dsh-ancesters ones) in both tags.
        for (const key of ["apiKey", "baseURL", "maxResults", "language", "save", "discard", "saveFailed", "invalidNumber"]) {
            assert.ok(key in entry.dicts.en && key in entry.dicts.zh, `en and zh carry ${key}`);
        }
        assert.notEqual(entry.dicts.zh.save, entry.dicts.en.save, "the plugin's zh copy wins over the fallback");
        env.dispose();
    });

    it("answers nothing for the summary shape (the bundle page asks for `page` only)", () => {
        const env = setup();
        assert.equal(env.render("summary"), "");
        env.dispose();
    });

    it("renders the body only — the page owns the container", () => {
        const env = setup();
        const html = env.render("page");
        assert.doesNotMatch(html, /<li |aria-expanded/, "no card shell or disclosure header is redrawn");
        for (const label of ["API key", "Endpoint", "Max results", "Language", "Save", "Discard"]) {
            assert.ok(html.includes(label), `renders ${label}`);
        }
        assert.match(html, /type="password"/, "the key control is write-only");
        assert.match(html, /placeholder="http:\/\/localhost:8080"/, "a blank endpoint shows the default it falls back to");
        env.dispose();
    });

    it("draws the Overridden badge only on fields the user layer carries", () => {
        const env = setup({ form: makeForm({ user: { baseURL: "http://mine.test" } }) });
        const html = env.render("page");
        assert.equal((html.match(/Overridden/g) || []).length, 1);
        assert.ok(html.includes("http://mine.test"));
        env.dispose();
    });

    it("says so when the deployment is read-only", () => {
        const env = setup({ form: makeForm({ writable: false }) });
        assert.match(env.render("page"), /stores its configuration read-only/);
        env.dispose();
    });
});

describe("the staged form", () => {
    it("writes nothing until Save, then writes each parsed draft", async () => {
        const env = setup();
        const keys = await env.keys();
        bundle.editField(env.controller, "baseURL", "http://sxng.test");
        bundle.editField(env.controller, "maxResults", "25");
        assert.deepEqual(env.form.writes, [], "a draft never reaches the Host on its own");
        assert.equal(bundle.projectBody(env.controller.getSnapshot(), keys.getSnapshot()).dirty, true);
        assert.equal(await bundle.saveCard(env.controller, keys), true);
        assert.deepEqual(env.form.writes, [["set", "baseURL", "http://sxng.test"], ["set", "maxResults", 25]]);
        assert.equal(typeof env.form.state.user.maxResults, "number", "the count is written as a number");
        assert.equal(env.controller.getSnapshot().dirty, false);
        env.dispose();
    });

    it("blocks the whole save while a draft does not parse", async () => {
        const env = setup();
        const keys = await env.keys();
        bundle.editField(env.controller, "baseURL", "http://sxng.test");
        bundle.editField(env.controller, "maxResults", "many");
        const view = bundle.projectBody(env.controller.getSnapshot(), keys.getSnapshot());
        assert.equal(view.invalid, true);
        assert.equal(view.fields.maxResults.invalid, true);
        assert.equal(bundle.planSave(env.controller), undefined);
        assert.equal(await bundle.saveCard(env.controller, keys), false);
        assert.deepEqual(env.form.writes, [], "not even the half that parsed");
        env.dispose();
    });

    it("rejects a count below one or with a fraction", async () => {
        const env = setup();
        for (const text of ["0", "2.5", "-3"]) {
            bundle.editField(env.controller, "maxResults", text);
            assert.equal(bundle.planSave(env.controller), undefined, `${text} is not a count`);
        }
        env.dispose();
    });

    it("turns a blank draft over a stored field into a reset to the row's answer", async () => {
        const env = setup({ form: makeForm({ user: { language: "pt" } }) });
        const keys = await env.keys();
        bundle.editField(env.controller, "language", "");
        assert.deepEqual(bundle.planSave(env.controller), [{ field: "language", kind: "reset" }]);
        assert.equal(await bundle.saveCard(env.controller, keys), true);
        assert.deepEqual(env.form.writes, [["unset", "language"]]);
        assert.ok(!("language" in env.form.state.user));
        env.dispose();
    });

    it("drops a draft that reads back as what is served", async () => {
        const env = setup({ form: makeForm({ user: { maxResults: 10 } }) });
        bundle.editField(env.controller, "maxResults", "10");
        assert.equal(env.controller.getSnapshot().dirty, false, "typing the served value stages nothing");
        bundle.editField(env.controller, "baseURL", "");
        assert.equal(env.controller.getSnapshot().dirty, false, "a blank over a field nothing answers stages nothing");
        env.dispose();
    });

    it("keeps the drafts and reports the failure when the Host refuses", async () => {
        const env = setup();
        const keys = await env.keys();
        env.form.refuse = true;
        bundle.editField(env.controller, "baseURL", "http://sxng.test");
        assert.equal(await bundle.saveCard(env.controller, keys), false);
        const view = bundle.projectBody(env.controller.getSnapshot(), keys.getSnapshot());
        assert.equal(view.failed, true);
        assert.equal(view.fields.baseURL.text, "http://sxng.test", "the user corrects rather than retyping");
        bundle.discardCard(env.controller, keys);
        assert.equal(env.controller.getSnapshot().dirty, false);
        env.dispose();
    });
});

describe("the API key", () => {
    it("is written through the credentials domain, never through the form", async () => {
        const env = setup();
        const keys = await env.keys();
        keys.edit("sxng-secret");
        assert.equal(bundle.projectBody(env.controller.getSnapshot(), keys.getSnapshot()).dirty, true);
        assert.equal(await bundle.saveCard(env.controller, keys), true);
        assert.deepEqual(env.credentials.sets, [["SEARXNG_API_KEY", "sxng-secret"]]);
        assert.deepEqual(env.form.writes, [], "the secret never lands in the profile");
        assert.equal(keys.getSnapshot().configured, true);
        assert.equal(keys.getSnapshot().draft, "", "a key that landed drops its draft");
        env.dispose();
    });

    it("addresses the reference the form answers for apiKeyEnv, and follows it", async () => {
        const env = setup({ form: makeForm({ user: { apiKeyEnv: "MY_SXNG_KEY" } }), credentials: makeCredentials({ stored: { MY_SXNG_KEY: "x" } }) });
        const keys = await env.keys();
        assert.equal(keys.getSnapshot().ref, "MY_SXNG_KEY");
        assert.equal(keys.getSnapshot().configured, true);
        env.form.advance({ value: { ...env.form.state.value, apiKeyEnv: "OTHER_KEY" } });
        await flush();
        assert.equal(keys.getSnapshot().ref, "OTHER_KEY");
        assert.equal(keys.getSnapshot().configured, false);
        env.dispose();
    });

    it("re-reads on an announcement for its reference, and ignores any other", async () => {
        const env = setup();
        const keys = await env.keys();
        const before = env.credentials.described.length;
        env.handlers.get("credentials/reference-updated")("SOMEONE_ELSE");
        await flush();
        assert.equal(env.credentials.described.length, before);
        env.credentials.stored.SEARXNG_API_KEY = "rotated";
        env.handlers.get("credentials/reference-updated")("SEARXNG_API_KEY");
        await flush();
        assert.equal(keys.getSnapshot().configured, true);
        env.dispose();
    });

    it("keeps the draft and reports the failure when the domain refuses", async () => {
        const env = setup({ credentials: makeCredentials({ refuse: true }) });
        const keys = await env.keys();
        keys.edit("sxng-secret");
        assert.equal(await bundle.saveCard(env.controller, keys), false);
        assert.equal(keys.getSnapshot().draft, "sxng-secret");
        assert.equal(bundle.projectBody(env.controller.getSnapshot(), keys.getSnapshot()).failed, true);
        env.dispose();
    });

    it("treats a blank draft as keep-what-is-there", async () => {
        const env = setup();
        const keys = await env.keys();
        keys.edit("   ");
        assert.equal(keys.dirty(), false);
        assert.equal(await bundle.saveCard(env.controller, keys), true);
        assert.deepEqual(env.credentials.sets, []);
        env.dispose();
    });
});
