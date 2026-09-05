import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const bundlePath = join(repoRoot, "lib", "client.js");
const BUNDLE_ID = "@deepseek-ai/dsh-web-search-searxng";
/** The only module edges the client bundle may require (platform seed words). */
const EXPECTED_REQUIRES = [
  "react",
  "react/jsx-runtime",
  "@deepseek-ai/dsh-client-ui-primitives",
  "@deepseek-ai/dsh-client-store",
];
/** The harness-shipped provider's namespace, whose card seat this bundle shadows. */
const DEEPSEEK_NS = "web-search-deepseek";
/** This plugin's own namespace. */
const SEARXNG_NS = "web-search-searxng";

/** Flush pending microtasks (credential reads settle on the microtask queue). */
const flush = () => new Promise((resolve) => setImmediate(resolve));

/**
 * Rebuild a JSON-shaped value as plain objects of THIS realm. The bundle runs in a
 * `node:vm` context, so the objects it returns carry that realm's prototypes and
 * `deepStrictEqual` rejects them; the rebuild strips the realm before comparing.
 * @param value - any JSON-shaped value (possibly vm-realm).
 * @returns an equal value built from this realm's Object/Array prototypes.
 */
function plain(value) {
  if (Array.isArray(value)) return value.map(plain);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, plain(entry)]));
  }
  return value;
}

// ---------------------------------------------------------------------------
// Module-table stubs: the four answers the loader would hand the factory.
// ---------------------------------------------------------------------------

/** Minimal snapshot store standing in for dsh-client-store's createSnapshotStore. */
function createSnapshotStore(init) {
  let state = init;
  const listeners = new Set();
  return {
    getSnapshot: () => state,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set: (next) => {
      state = next;
      for (const fn of [...listeners]) fn();
    },
  };
}

const moduleTable = new Map([
  ["react", { useState: () => [false, () => {}] }],
  ["react/jsx-runtime", { jsx: () => null, jsxs: () => null }],
  ["@deepseek-ai/dsh-client-ui-primitives", { IconChevronDownOutline14: () => null }],
  ["@deepseek-ai/dsh-client-store", { createSnapshotStore }],
]);

/** Evaluate the bundle in a bare browser-ish context and return its factory. */
function loadBundleFactory() {
  const source = readFileSync(bundlePath, "utf8");
  const required = [];
  const pending = [];
  const context = vm.createContext({
    window: { __ModuleLoader__: { load: (registration) => pending.push(registration) } },
  });
  vm.runInContext(source, context, { filename: "client.js" });
  assert.equal(pending.length, 1, "the bundle registers exactly one factory");
  assert.equal(pending[0].id, BUNDLE_ID);
  const exports = pending[0].factory((specifier) => {
    required.push(specifier);
    const answer = moduleTable.get(specifier);
    assert.notEqual(answer, undefined, `bundle requires a specifier the module table cannot answer: ${specifier}`);
    return answer;
  });
  return { exports, required };
}

// ---------------------------------------------------------------------------
// Fake browser plugin context: the cordis service faces apply() consumes.
// ---------------------------------------------------------------------------

/** A fake bound settings scope whose snapshot the test advances by hand. */
function fakeScope(initial) {
  let snapshot = initial;
  const subscribers = new Set();
  const emit = () => {
    for (const fn of [...subscribers]) fn();
  };
  const scope = {
    getSnapshot: () => snapshot,
    subscribe: (fn) => {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    async set(field, value) {
      snapshot = {
        ...snapshot,
        revision: (snapshot.revision ?? 0) + 1,
        user: { ...(snapshot.user ?? {}), [field]: value },
        value: { ...snapshot.value, [field]: value },
      };
      emit();
    },
    async unset(field) {
      const user = { ...(snapshot.user ?? {}) };
      delete user[field];
      snapshot = { ...snapshot, revision: (snapshot.revision ?? 0) + 1, user };
      emit();
    },
    /** Replace the whole snapshot (Host-side change). @param next - the next snapshot. */
    advance(next) {
      snapshot = next;
      emit();
    },
  };
  return scope;
}

const LOADING = { status: "loading", value: undefined, base: undefined, user: undefined, revision: undefined, writable: true, mode: "host" };

function fakeCtx() {
  const describeCalls = [];
  const setCalls = [];
  const credentialsState = {
    DEEPSEEK_API_KEY: { configured: false, writable: true },
    SEARXNG_API_KEY: { configured: false, writable: true },
  };
  const localeRegs = [];
  const remoteListeners = [];
  const registrations = [];
  const scope = fakeScope(LOADING);
  const binds = [];
  const ctx = {
    effect: (fn, label) => {
      assert.equal(typeof label, "string", "effects carry a diagnostic label");
      fn();
    },
    locale: {
      bind: (ns) => (key) => String(key),
      register: (ns, dict) => {
        localeRegs.push([ns, dict]);
        return () => {};
      },
    },
    settingsScope: {
      bind: (spec) => {
        binds.push(spec);
        assert.equal(spec.namespace, SEARXNG_NS, "the card binds its own namespace only");
        return scope;
      },
    },
    remote: {
      $on: (event, fn) => {
        remoteListeners.push([event, fn]);
        return () => {};
      },
      credentials: {
        describe: async (refs) => {
          describeCalls.push([...refs]);
          return {
            ok: true,
            value: Object.fromEntries(refs.map((ref) => [ref, credentialsState[ref]])),
          };
        },
        set: async (ref, value) => {
          setCalls.push({ ref, value });
          credentialsState[ref] = { configured: true, writable: true };
        },
      },
    },
    slots: {
      inject: (key, callback) => {
        assert.equal(key, "settings.plugin.item");
        const effect = callback();
        if (typeof effect?.[Symbol.iterator] === "function") for (const _disposer of effect) void 0;
      },
      register: (options, component) => {
        registrations.push({ options, component });
        return () => {};
      },
    },
  };
  return { ctx, scope, binds, describeCalls, setCalls, credentialsState, localeRegs, remoteListeners, registrations };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("lib/client.js client bundle", () => {
  describe("artifact contract", () => {
    test("package.json declares the dsh.client face and the ./client export", () => {
      const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
      assert.equal(pkg.dsh?.client?.platform, "web");
      assert.deepEqual(pkg.dsh.client.inject, [
        "@deepseek-ai/dsh-client-locale",
        "@deepseek-ai/dsh-client-ui-settings",
        "@deepseek-ai/dsh-api-remotes",
      ]);
      assert.equal(pkg.dsh.client.external, undefined, "the bundle requires platform seed words only");
      assert.equal(pkg.exports["./client"]?.default, "./lib/client.js");
      assert.ok(pkg.exports["./client"].types, "the ./client export carries a types condition");
      assert.ok(pkg.files.includes("lib/client.js"), "lib/client.js is published");
      assert.ok(existsSync(bundlePath), "the bundle artifact exists");
    });
  });

  describe("factory registration and module edges", () => {
    let exports;
    let required;
    before(() => {
      ({ exports, required } = loadBundleFactory());
    });

    test("requires only the platform seed words", () => {
      assert.deepEqual([...required].sort(), [...EXPECTED_REQUIRES].sort());
    });

    test("exports the plugin face", () => {
      assert.equal(typeof exports.apply, "function");
      assert.deepEqual([...exports.inject], ["slots", "locale", "remote", "remote.credentials", "settingsScope"]);
    });
  });

  describe("apply() wiring", () => {
    let rig;
    let face;
    before(async () => {
      const { exports } = loadBundleFactory();
      rig = fakeCtx();
      exports.apply(rig.ctx);
      assert.equal(rig.registrations.length, 2, "tombstone + card entries register");
      const [deepseekEntry, searxngEntry] = rig.registrations;
      for (const entry of [deepseekEntry, searxngEntry]) {
        assert.equal(typeof entry.component, "function", "each entry carries a component");
      }
      assert.deepEqual(plain(deepseekEntry.options), {
        name: "settings.plugin.item",
        key: DEEPSEEK_NS,
        priority: -1,
        locale: SEARXNG_NS,
      });
      assert.equal(deepseekEntry.options.inject, undefined, "the tombstone injects no face");
      assert.equal(deepseekEntry.component(), null, "the tombstone renders nothing under the shipped key");
      const { inject: searxngInject, ...searxngOptions } = searxngEntry.options;
      assert.deepEqual(plain(searxngOptions), {
        name: "settings.plugin.item",
        key: SEARXNG_NS,
        locale: SEARXNG_NS,
      });
      assert.ok(!("priority" in searxngOptions), "the card registers at the default priority");
      assert.notEqual(deepseekEntry.component, searxngEntry.component, "the tombstone is a distinct component");
      face = searxngInject();
      assert.ok(face.hooks?.webSearchCard, "the card entry injects the card snapshot store");
    });

    test("binds the settings scope of its own namespace only", () => {
      assert.deepEqual(plain(rig.binds), [{ namespace: SEARXNG_NS }]);
    });

    test("registers the en/zh dictionaries under its locale namespace", () => {
      assert.equal(rig.localeRegs.length, 1);
      const [ns, dict] = rig.localeRegs[0];
      assert.equal(ns, SEARXNG_NS);
      assert.ok(dict.en && dict.zh);
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
        "overridden",
      ]) {
        assert.ok(dict.en[key], `en copy carries ${key}`);
        assert.ok(dict.zh[key], `zh copy carries ${key}`);
      }
      assert.equal(dict.en.title, "SearXNG", "the title names SearXNG");
      assert.equal(dict.en.description, "The SearXNG meta-search provider.", "the description names SearXNG");
    });

    test("subscribes to credential invalidations for the watched reference", async () => {
      assert.deepEqual(rig.remoteListeners, [["credentials/reference-updated", rig.remoteListeners[0][1]]]);
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
        mode: "host",
      });
      await flush();
    });

    test("shows the effective values once the Host serves the section", () => {
      const state = snapshot();
      assert.equal(state.available, true);
      assert.equal(state.writable, true);
      assert.equal(state.dirty, false);
      assert.deepEqual(plain(state.baseURL), { text: "http://localhost:8080", overridden: false, invalid: false });
      assert.equal(state.maxResults.text, "10");
      assert.equal(state.language.text, "all");
      assert.equal(state.apiKeyConfigured, false);
    });

    test("stages edits without writing, and marks what a save would override", () => {
      face.edit("baseURL", "http://localhost:8099");
      assert.equal(snapshot().dirty, true);
      assert.equal(snapshot().baseURL.text, "http://localhost:8099");
      assert.equal(snapshot().baseURL.overridden, true);
      assert.equal(rig.scope.getSnapshot().user, undefined, "no write crossed the wire");
      face.edit("maxResults", "25");
      assert.equal(snapshot().maxResults.text, "25");
    });

    test("refuses a save while a draft is invalid", async () => {
      face.edit("maxResults", "not-a-number");
      assert.equal(snapshot().invalid, true);
      face.onSave();
      await flush();
      assert.equal(rig.scope.getSnapshot().user, undefined, "an invalid draft blocks the whole save");
      face.edit("maxResults", "25");
      assert.equal(snapshot().invalid, false);
    });

    test("save writes each staged field through the scope and re-seeds", async () => {
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

    test("saving a blank for an un-overridden field only plans the re-inheriting clear", async () => {
      face.edit("language", "");
      face.onSave();
      await flush();
      assert.equal(rig.scope.getSnapshot().user?.language, undefined, "no user-layer entry is created");
      assert.equal(snapshot().dirty, false);
    });

    test("reset stages a clear that unsets an override on save", async () => {
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

    test("discard drops drafts and failure flags without writing", () => {
      face.edit("baseURL", "http://will-not-save:1");
      assert.equal(snapshot().dirty, true);
      face.onDiscard();
      assert.equal(snapshot().dirty, false);
      assert.equal(snapshot().baseURL.text, "http://localhost:8099", "the control re-seeds from the section");
    });

    test("a save that did not land keeps its drafts and flags the failure", async () => {
      // A Host that refuses the write: set resolves, but the user layer keeps no trace,
      // so the form's read-back reports the save did not land.
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

    test("the credential control writes through the credentials domain", async () => {
      face.edit("apiKey", "sxng-secret");
      face.onSave();
      await flush();
      assert.deepEqual(plain(rig.setCalls), [{ ref: "SEARXNG_API_KEY", value: "sxng-secret" }]);
      assert.equal(snapshot().apiKeyConfigured, true, "the re-read reports the key as configured");
      assert.equal(snapshot().dirty, false, "a landed credential write clears the draft");
    });

    test("a blank credential draft writes nothing", async () => {
      const writes = rig.setCalls.length;
      face.edit("apiKey", "   ");
      assert.equal(snapshot().dirty, false, "blank key drafts plan no write");
      face.onSave();
      await flush();
      assert.equal(rig.setCalls.length, writes);
    });

    test("the credential reference follows the section's effective apiKeyEnv", async () => {
      // The card no longer edits apiKeyEnv; the reference it addresses can still
      // move underneath it (settings file, composed layer), and the key
      // control must follow.
      const before = rig.describeCalls.length;
      const current = rig.scope.getSnapshot();
      rig.scope.advance({
        ...current,
        value: { ...current.value, apiKeyEnv: "OTHER_REF" },
        user: { ...current.user, apiKeyEnv: "OTHER_REF" },
      });
      await flush();
      assert.ok(
        rig.describeCalls.slice(before).some((refs) => refs.includes("OTHER_REF")),
        "a section change re-points the reference the key control addresses"
      );
    });

    test("the tombstone shadows the shipped card while the card holds its own key", () => {
      const [tombstoneEntry, cardEntry] = rig.registrations;
      assert.equal(tombstoneEntry.options.key, DEEPSEEK_NS, "the shadow claims the shipped card's key");
      assert.ok(tombstoneEntry.options.priority < 0, "a negative priority wins the keyed dispatch over the shipped card at 0");
      assert.equal(cardEntry.options.key, SEARXNG_NS, "the card itself holds its own key");
      assert.equal(tombstoneEntry.component(), null, "the shadowed cell renders nothing");
    });
  });
});
