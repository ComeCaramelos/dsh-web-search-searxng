/**
 * Behavior spec for the emitted browser bundle.
 *
 * Materializes `lib/client.js` in a stubbed browser environment — the same
 * `window.__ModuleLoader__.load` contract the shell's module system uses — and
 * drives the card through it: registration, the module edges it requires, the
 * two slot entries, the staged form, what a save writes, and what the widget
 * renders.
 *
 * The bundle is the only surface exercised here: every module behind it is
 * reached through the emitted file, exactly as the running GUI reaches it.
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const bundlePath = join(repoRoot, "lib", "client.js");
const BUNDLE_ID = "@comecaramelos/dsh-web-search-searxng";
/** The only module edges the bundle may require: the platform seed words. */
const EXPECTED_REQUIRES = ["react", "react/jsx-runtime", "@deepseek-ai/dsh-client-ui-primitives", "@deepseek-ai/dsh-client-store"];
/** The namespace the shipped card registers under, which this bundle shadows. */
const DEEPSEEK_NS = "web-search-deepseek";
/** This plugin's own namespace. */
const SEARXNG_NS = "web-search-searxng";

/** Flush pending microtasks: credential reads settle on the microtask queue. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

/**
 * Rebuild a JSON-shaped value as plain objects of THIS realm. The bundle runs in
 * a `node:vm` context, so objects it returns carry that realm's prototypes and
 * `deepStrictEqual` rejects them; the rebuild strips the realm before comparing.
 */
function plain(value) {
    if (Array.isArray(value)) return value.map(plain);
    if (value !== null && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, plain(entry)]));
    }
    return value;
}

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

const moduleTable = new Map([
    ["react", { useState: () => [false, () => {}] }],
    ["react/jsx-runtime", { jsx: () => null, jsxs: () => null }],
    ["@deepseek-ai/dsh-client-ui-primitives", { IconChevronDownOutline14: () => null }],
    ["@deepseek-ai/dsh-client-store", { createSnapshotStore }]
]);

/** Evaluate the bundle in a bare browser-ish context and return its face. */
function loadBundleFactory(globals = {}) {
    const source = readFileSync(bundlePath, "utf8");
    const required = [];
    const pending = [];
    const context = vm.createContext({
        ...globals,
        window: { __ModuleLoader__: { load: (registration) => pending.push(registration) } }
    });
    vm.runInContext(source, context, { filename: "client.js" });
    assert.equal(pending.length, 1, "the bundle registers exactly one factory");
    assert.equal(pending[0].id, BUNDLE_ID);
    const exports = pending[0].factory((specifier) => {
        required.push(specifier);
        const answer = moduleTable.get(specifier);
        assert.notEqual(answer, undefined, `the bundle requires a specifier the module table cannot answer: ${specifier}`);
        return answer;
    });
    return { exports, required };
}

/** A fake bound settings scope whose snapshot the test advances by hand. */
function fakeScope(initial) {
    let snapshot = initial;
    const subscribers = new Set();
    const emit = () => {
        for (const notify of [...subscribers]) notify();
    };
    const scope = {
        getSnapshot: () => snapshot,
        subscribe: (notify) => {
            subscribers.add(notify);
            return () => subscribers.delete(notify);
        },
        async set(field, value) {
            snapshot = {
                ...snapshot,
                revision: (snapshot.revision ?? 0) + 1,
                user: { ...(snapshot.user ?? {}), [field]: value },
                value: { ...snapshot.value, [field]: value }
            };
            emit();
        },
        async unset(field) {
            const user = { ...(snapshot.user ?? {}) };
            delete user[field];
            snapshot = { ...snapshot, revision: (snapshot.revision ?? 0) + 1, user };
            emit();
        },
        /** Replace the whole snapshot (a Host-side change). */
        advance(next) {
            snapshot = next;
            emit();
        }
    };
    return scope;
}

const LOADING = {
    status: "loading",
    value: undefined,
    base: undefined,
    user: undefined,
    revision: undefined,
    writable: true,
    mode: "host"
};

function fakeCtx() {
    const describeCalls = [];
    const setCalls = [];
    const credentialsState = {
        DEEPSEEK_API_KEY: { configured: false, writable: true },
        SEARXNG_API_KEY: { configured: false, writable: true }
    };
    const localeRegs = [];
    const remoteListeners = [];
    const registrations = [];
    const scope = fakeScope(LOADING);
    const binds = [];
    const effects = [];
    const ctx = {
        effect: (run, label) => {
            assert.equal(typeof label, "string", "effects carry a diagnostic label");
            effects.push(label);
            run();
        },
        locale: {
            bind: () => (key) => String(key),
            register: (ns, dictionary) => {
                localeRegs.push([ns, dictionary]);
                return () => {};
            }
        },
        settingsScope: {
            bind: (spec) => {
                binds.push(spec);
                assert.equal(spec.namespace, SEARXNG_NS, "the card binds its own namespace only");
                return scope;
            }
        },
        remote: {
            $on: (event, listener) => {
                remoteListeners.push([event, listener]);
                return () => {};
            },
            credentials: {
                describe: async (refs) => {
                    describeCalls.push([...refs]);
                    return {
                        ok: true,
                        value: Object.fromEntries(refs.map((ref) => [ref, credentialsState[ref]]))
                    };
                },
                set: async (ref, value) => {
                    setCalls.push({ ref, value });
                    credentialsState[ref] = { configured: true, writable: true };
                }
            }
        },
        slots: {
            inject: (name, callback) => {
                assert.equal(name, "settings.plugin.item");
                const generator = callback();
                // Draining the generator runs the registrations and keeps the
                // disposers alive, exactly as the slot's own contract expects.
                for (const _disposer of generator) void 0;
            },
            register: (options, component) => {
                registrations.push({ options, component });
                return () => {};
            }
        }
    };
    return { ctx, scope, binds, describeCalls, setCalls, credentialsState, localeRegs, remoteListeners, registrations, effects };
}

describe("lib/client.js — the emitted browser bundle", () => {
    describe("artifact contract", () => {
        it("package.json declares the dsh.client face and the ./client export", () => {
            const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
            assert.equal(pkg.dsh?.client?.platform, "web");
            assert.deepEqual(pkg.dsh.client.inject, [
                "@deepseek-ai/dsh-client-locale",
                "@deepseek-ai/dsh-client-ui-settings",
                "@deepseek-ai/dsh-api-remotes"
            ]);
            assert.equal(pkg.dsh.client.external, undefined, "the bundle requires platform seed words only");
            assert.equal(pkg.exports["./client"]?.default, "./lib/client.js");
            assert.ok(pkg.exports["./client"].types, "the ./client export carries a types condition");
            assert.ok(existsSync(bundlePath), "the bundle artifact exists");
        });

        it("requires only the platform seed words", () => {
            const { required } = loadBundleFactory();
            assert.deepEqual([...new Set(required)].sort(), [...EXPECTED_REQUIRES].sort());
        });

        it("exports the plugin face", () => {
            const { exports } = loadBundleFactory();
            assert.equal(typeof exports.apply, "function");
            assert.deepEqual([...exports.inject], ["slots", "locale", "remote", "remote.credentials", "settingsScope"]);
        });
    });

    describe("the card stylesheet", () => {
        /** The sheet as it lands in the bundle: scoped rules plus their map. */
        function sheet() {
            const source = readFileSync(bundlePath, "utf8");
            const cssText = JSON.parse(`"${source.match(/var cssText = "(.*?)";/s)[1]}"`);
            const map = JSON.parse(source.match(/var SearxngCard_default = (\{.*?\});/s)[1].replace(/(\w+):/g, '"$1":'));
            return { cssText, map };
        }

        /**
         * The alias tokens the shell's own surfaces use. A token outside this set
         * is not defined anywhere, so its declaration resolves to nothing: the
         * declaration is simply ignored, which reads as a missing style rather
         * than an error — in the browser nothing complains.
         */
        const ALIAS_TOKENS = new Set([
            "bg-layer-1",
            "bg-layer-2",
            "bg-layer-3",
            "bg-module-platform",
            "border-l2",
            "border-l3",
            "border-l4",
            "brand-primary",
            // Both are carried by the sibling cards the sheet mirrors (the hover
            // state of every action, and the state-error voice of every failure
            // line), and the shell's own surfaces define them.
            "interactive-bg-hover",
            "state-error-primary",
            "label-primary",
            "label-secondary",
            "label-tertiary",
            "label-dimmed",
            "label-error"
        ]);

        it("scopes every selector to one build-derived prefix", () => {
            const { cssText } = sheet();
            const rules = cssText.split("}").map((rule) => rule.slice(0, rule.indexOf("{")).trim()).filter(Boolean);
            assert.ok(rules.length > 0, "the sheet carries rules");
            // A selector the browser cannot parse is dropped without a word, and
            // a class may not begin with a digit: one digit-led prefix would mean
            // the whole sheet styles nothing.
            const unscoped = rules.filter((selector) =>
                /[.]([\w-]+)/g.test(selector) &&
                [...selector.matchAll(/\.([\w-]+)/g)].some(([, name]) => !/^[a-z][a-z0-9]{5}_/.test(name)));
            assert.deepEqual(unscoped, [], `selectors left unscoped or digit-led: ${unscoped.join(", ")}`);
            const prefixes = new Set([...cssText.matchAll(/\.([a-z][a-z0-9]{5})_/g)].map(([, prefix]) => prefix));
            assert.equal(prefixes.size, 1, `one prefix expected, saw: ${[...prefixes].join(", ")}`);
        });

        it("names only tokens the shell defines", () => {
            const { cssText } = sheet();
            const tokens = new Set((cssText.match(/--dsw-alias-([a-z0-9-]+)/g) ?? []).map((t) => t.slice("--dsw-alias-".length)));
            const unknown = [...tokens].filter((token) => !ALIAS_TOKENS.has(token));
            assert.deepEqual(unknown, [], `tokens the harness does not define: ${unknown.join(", ")}`);
        });

        it("gives every class the card reads a scoped rule of its own", () => {
            const { cssText, map } = sheet();
            const missing = Object.entries(map).filter(([, scoped]) => !cssText.includes(`.${scoped}{`));
            assert.deepEqual(missing, [], `classes without a scoped rule: ${missing.map(([k]) => k).join(", ")}`);
        });

        it("injects its sheet once, under the plugin's own id", () => {
            const head = [];
            const document = {
                head: {
                    appendChild: (element) => head.push(element)
                },
                createElement: (tag) => {
                    assert.equal(tag, "style");
                    return { dataset: {}, textContent: "" };
                },
                querySelector: (selector) => head.find((element) => `style[data-plugin-css=${JSON.stringify(element.dataset.pluginCss)}]` === selector) ?? null
            };
            const { exports } = loadBundleFactory({ document });
            const rig = fakeCtx();
            exports.apply(rig.ctx);
            assert.equal(head.length, 1, "exactly one stylesheet element");
            assert.equal(head[0].dataset.pluginCss, `${BUNDLE_ID}/SearxngCard.module.css`);
            assert.equal(head[0].dataset.plugin, BUNDLE_ID);
            assert.ok(head[0].textContent.includes("{"), "the element carries rules");
            // A re-materialized bundle must not stack a second copy.
            const second = loadBundleFactory({ document });
            second.exports.apply(fakeCtx().ctx);
            assert.equal(head.length, 1, "applying the bundle again injects nothing more");
        });
    });

    describe("apply() wiring", () => {
        let rig;
        let face;
        before(async () => {
            const { exports } = loadBundleFactory();
            rig = fakeCtx();
            exports.apply(rig.ctx);
            await flush();
        });

        it("registers two cells: the tombstone and the card", () => {
            assert.equal(rig.registrations.length, 2, "tombstone + card entries register");
            const [deepseekEntry, searxngEntry] = rig.registrations;
            for (const entry of [deepseekEntry, searxngEntry]) {
                assert.equal(typeof entry.component, "function", "each entry carries a component");
            }
            assert.deepEqual(plain(deepseekEntry.options), {
                name: "settings.plugin.item",
                key: DEEPSEEK_NS,
                priority: -1,
                locale: SEARXNG_NS
            });
            assert.equal(deepseekEntry.options.inject, undefined, "the tombstone injects no face");
            assert.equal(deepseekEntry.component(), null, "the tombstone renders nothing under the shipped key");
            const { inject: searxngInject, ...searxngOptions } = searxngEntry.options;
            assert.deepEqual(plain(searxngOptions), {
                name: "settings.plugin.item",
                key: SEARXNG_NS,
                locale: SEARXNG_NS
            });
            assert.ok(!("priority" in searxngOptions), "the card registers at the default priority");
            assert.notEqual(deepseekEntry.component, searxngEntry.component, "the tombstone is a distinct component");
            face = searxngInject();
            assert.ok(face.hooks?.webSearchCard, "the card entry injects the card snapshot store");
        });

        it("binds the settings scope of its own namespace only", () => {
            assert.deepEqual(plain(rig.binds), [{ namespace: SEARXNG_NS }]);
        });

        it("registers the en/zh dictionaries under its locale namespace", () => {
            assert.equal(rig.localeRegs.length, 1);
            const [ns, dictionary] = rig.localeRegs[0];
            assert.equal(ns, SEARXNG_NS);
            assert.ok(dictionary.en && dictionary.zh);
            for (const key of [
                "title",
                "description",
                "apiKey",
                "apiKeyHint",
                "apiKeySet",
                "apiKeyUnset",
                "baseURL",
                "baseURLHint",
                "maxResults",
                "maxResultsHint",
                "language",
                "languageHint",
                "save",
                "discard",
                "reset",
                "overridden"
            ]) {
                assert.ok(dictionary.en[key], `en copy carries ${key}`);
                assert.ok(dictionary.zh[key], `zh copy carries ${key}`);
            }
            assert.equal(dictionary.en.title, "SearXNG", "the title names SearXNG");
            assert.equal(dictionary.en.description, "The SearXNG meta-search provider.", "the description names SearXNG");
        });

        it("subscribes to credential invalidations for the watched reference", async () => {
            assert.deepEqual(rig.remoteListeners.map(([event]) => event), ["credentials/reference-updated"]);
            const describeCount = rig.describeCalls.length;
            rig.remoteListeners[0][1]("SOME_OTHER_REF");
            await flush();
            assert.equal(rig.describeCalls.length, describeCount, "a foreign reference does not re-read");
            rig.remoteListeners[0][1]("DEEPSEEK_API_KEY");
            await flush();
            assert.equal(rig.describeCalls.length, describeCount, "the DeepSeek reference is not this card's");
            rig.remoteListeners[0][1]("SEARXNG_API_KEY");
            await flush();
            assert.equal(rig.describeCalls.length, describeCount + 1, "the watched reference re-reads");
        });
    });

    describe("card staging and saving", () => {
        let rig;
        let face;
        let store;
        const snapshot = () => store.getSnapshot();
        before(async () => {
            const { exports } = loadBundleFactory();
            rig = fakeCtx();
            exports.apply(rig.ctx);
            face = rig.registrations[1].options.inject();
            store = face.hooks.webSearchCard;
            assert.equal(store.getSnapshot().available, false, "nothing renders while the section is still loading");
            rig.scope.advance({
                status: "ready",
                value: { baseURL: "http://localhost:8080", maxResults: 10, language: "all", apiKeyEnv: "SEARXNG_API_KEY" },
                base: { baseURL: "http://localhost:8080", maxResults: 10 },
                user: undefined,
                revision: 0,
                writable: true,
                mode: "host"
            });
            await flush();
        });

        it("shows the effective values once the Host serves the section", () => {
            const state = snapshot();
            assert.equal(state.available, true);
            assert.equal(state.writable, true);
            assert.equal(state.dirty, false);
            assert.deepEqual(plain(state.baseURL), { text: "http://localhost:8080", overridden: false, invalid: false });
            assert.equal(state.maxResults.text, "10");
            assert.equal(state.language.text, "all");
            assert.equal(state.apiKeyConfigured, false);
        });

        it("stages edits without writing, and marks what a save would override", () => {
            face.edit("baseURL", "http://localhost:8099");
            assert.equal(snapshot().dirty, true);
            assert.equal(snapshot().baseURL.text, "http://localhost:8099");
            assert.equal(snapshot().baseURL.overridden, true);
            assert.equal(rig.scope.getSnapshot().user, undefined, "no write crossed the wire");
            face.edit("maxResults", "25");
            assert.equal(snapshot().maxResults.text, "25");
        });

        it("refuses a save while a draft is invalid", async () => {
            face.edit("maxResults", "not-a-number");
            assert.equal(snapshot().invalid, true);
            face.onSave();
            await flush();
            assert.equal(rig.scope.getSnapshot().user, undefined, "an invalid draft blocks the whole save");
            face.edit("maxResults", "25");
            assert.equal(snapshot().invalid, false);
        });

        it("save writes each staged field through the scope and re-seeds", async () => {
            face.onSave();
            await flush();
            const state = snapshot();
            assert.equal(state.dirty, false, "a landed save clears the drafts");
            assert.equal(state.failed, false);
            assert.equal(rig.scope.getSnapshot().user?.baseURL, "http://localhost:8099");
            assert.equal(rig.scope.getSnapshot().user?.maxResults, 25);
            assert.equal(state.baseURL.overridden, true, "the user layer now marks the field overridden");
            assert.equal(state.maxResults.overridden, true);
        });

        it("saving a blank for an un-overridden field only plans the re-inheriting clear", async () => {
            face.edit("language", "");
            face.onSave();
            await flush();
            assert.equal(rig.scope.getSnapshot().user?.language, undefined, "no user-layer entry is created");
            assert.equal(snapshot().dirty, false);
        });

        it("reset stages a clear that unsets an override on save", async () => {
            face.edit("language", "es");
            assert.equal(snapshot().dirty, true);
            face.onSave();
            await flush();
            assert.equal(rig.scope.getSnapshot().user?.language, "es");
            face.resetField("language");
            assert.equal(snapshot().dirty, true, "the staged clear still counts as an unsaved edit");
            assert.equal(snapshot().language.overridden, false, "the badge previews the re-inheritance");
            face.onSave();
            await flush();
            assert.equal(rig.scope.getSnapshot().user?.language, undefined, "the clear landed");
        });

        it("discard drops drafts and failure flags without writing", () => {
            face.edit("baseURL", "http://will-not-save:1");
            assert.equal(snapshot().dirty, true);
            face.onDiscard();
            assert.equal(snapshot().dirty, false);
            assert.equal(snapshot().baseURL.text, "http://localhost:8099", "the control re-seeds from the section");
        });

        it("a save that did not land keeps its drafts and flags the failure", async () => {
            // A Host that refuses the write: `set` resolves, but the user layer
            // keeps no trace, so the form's read-back reports the save did not land.
            const realSet = rig.scope.set;
            rig.scope.set = async () => {};
            face.edit("language", "refused");
            assert.equal(snapshot().dirty, true);
            face.onSave();
            await flush();
            assert.equal(snapshot().failed, true, "the footer reports the failed save");
            assert.equal(snapshot().dirty, true, "the drafts survive a refused save");
            assert.equal(snapshot().language.text, "refused", "the user can correct instead of retyping");
            face.edit("language", "fr");
            assert.equal(snapshot().failed, false, "staging an edit clears the failure flag");
            face.onDiscard();
            rig.scope.set = realSet;
        });

        it("the credential control writes through the credentials domain", async () => {
            face.edit("apiKey", "sxng-secret");
            face.onSave();
            await flush();
            assert.deepEqual(plain(rig.setCalls), [{ ref: "SEARXNG_API_KEY", value: "sxng-secret" }]);
            assert.equal(snapshot().apiKeyConfigured, true, "the re-read reports the key as configured");
            assert.equal(snapshot().dirty, false, "a landed credential write clears the draft");
        });

        it("a blank credential draft writes nothing", async () => {
            const writes = rig.setCalls.length;
            face.edit("apiKey", "   ");
            assert.equal(snapshot().dirty, false, "blank key drafts plan no write");
            face.onSave();
            await flush();
            assert.equal(rig.setCalls.length, writes);
        });

        it("the credential reference follows the section's effective apiKeyEnv", async () => {
            // The card no longer edits apiKeyEnv; the reference it addresses can
            // still move underneath it (settings file, composed layer), and the
            // key control must follow.
            const before = rig.describeCalls.length;
            const current = rig.scope.getSnapshot();
            rig.scope.advance({
                ...current,
                value: { ...current.value, apiKeyEnv: "OTHER_REF" },
                user: { ...current.user, apiKeyEnv: "OTHER_REF" }
            });
            await flush();
            assert.ok(
                rig.describeCalls.slice(before).some((refs) => refs.includes("OTHER_REF")),
                "a section change re-points the reference the key control addresses"
            );
        });

        it("the tombstone shadows the shipped card while the card holds its own key", () => {
            const [tombstoneEntry, cardEntry] = rig.registrations;
            assert.equal(tombstoneEntry.options.key, DEEPSEEK_NS, "the shadow claims the shipped card's key");
            assert.ok(
                tombstoneEntry.options.priority < 0,
                "a negative priority wins the keyed dispatch over the shipped card at 0"
            );
            assert.equal(cardEntry.options.key, SEARXNG_NS, "the card itself holds its own key");
            assert.equal(tombstoneEntry.component(), null, "the shadowed cell renders nothing");
        });
    });
});
