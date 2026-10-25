# AGENTS.md

Guide for code agents working in this repository.

## What this project is

`@comecaramelos/dsh-web-search-searxng` is a **DeepSeek Harness (DSH) plugin**
that implements a `WebSearchProvider` backed by [SearXNG](https://docs.searxng.org/).
It registers into the web capability seam (`ctx.web`) and converts SearXNG's
JSON API (`GET /search?format=json`) into the harness's normalized
`WebSearchResult`.

- It is a **provider, not a tool**: it registers nothing visible to the model.
  The tool is exposed by `dsh-tool-web`; this package only feeds the seam.
- Function/namespace plugin: `inject: ['web']`, `name: "web-search-searxng"`.
- Each search = a single HTTP `GET` (no model cost).
- Targets **dsh `^0.2.0`** (`engines.dsh: "^0.2.0-0"`, peers `^0.2.0-0`). The
  dsh 0.2 configuration surface (row identity, the configuration form, the row
  page) is consumed through **`@comecaramelos/dsh-ancesters`** (sibling checkout
  `../dsh-ancesters`, linked as `file:` devDependency — not on npm). Never
  re-implement what it owns here (form attach, auto-page off, controller, write
  door, slot registration); a gap goes into ancesters as a typed
  hole, not into this package.
- Official subsystem documentation:
  <https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/web>

## Commands

```bash
npm run build                       # tsc (src/host) + esbuild bundle (src/client → lib/client.js)
npm test                            # builds first (pretest), then node --test test/*.test.mjs
bash publish-to-github.sh           # publishes to GitHub (requires gh auth login)
```

Sources are TypeScript; `lib/` is emitted output and is gitignored. **Never
hand-edit anything under `lib/`** — the same rule applies to `lib/client.js`,
which `scripts/build-client.mjs` generates from `src/client/**` (esbuild, CJS
factory shape + CSS modules inlined) and never edits by hand. Run
`npm run clean && npm run build` when output looks stale.

The emitted browser bundle must stay dependency-free at the require level:
platform seed words only (`react`, `react/jsx-runtime`,
`@deepseek-ai/dsh-client-ui-primitives`, `@deepseek-ai/dsh-client-store`) —
the shell materializes the seeds before any plugin bundle, so
`dsh.client.external` stays empty and `BASELINE_MODULES` in
`scripts/build-client.mjs` lists exactly them as externals.

## Structure

```
src/index.ts             # Host surface: identity, constants, Config, apply, provider re-exports
src/provider.ts          # ./provider entry: provider + mapping + constants, reusable without the plugin
src/host/constants.ts    # IDs, defaults, env-var names, header constants
src/host/plugin-meta.ts  # name + inject (the cordis face)
src/host/schema.ts       # Config (schemastery, every field .volatile()) + Config / ConfigValues types
src/host/settings.ts     # attachConfigForm (ancesters attachSettingsForm) + configSource thunk
src/host/apply.ts        # apply(ctx, config): form attach + provider registration
src/host/values.ts       # resolveOptions: form → env → constant
src/host/credentials.ts  # apiKeyRef/apiKeyEnvName + the per-search key thunk
src/host/recorder.ts     # the secret-free `web/searxng-search-request` session event
src/host/request.ts      # buildSearchRequest: URL + headers
src/host/provider.ts     # SearxngSearchProvider
src/host/mapping.ts      # mapSearxngResult / mapSearxngResponse
src/host/abort.ts        # abort helpers, all normalized to WEB_ABORTED
src/host/types/          # shared type sections (config / search / services)
src/client/index.ts      # browser surface: mountSettingsCard descriptor, apply + inject, key wiring
src/client/plugin-meta.ts# plugin id, entry id, locale namespace, staged fields
src/client/controller/   # fields.ts (parse specs), credentials.ts (KeyController over remote.credentials)
src/client/card/         # body.ts (the one block: projection, save plan, page body), fields.ts (ValueField/SecretField)
src/client/styles/       # SearxngCard.module.css + one-shot injection + css-modules.d.ts
src/client/locales/      # en / zh dictionaries (files en-US.ts / zh-CN.ts)
src/client/shell-modules.d.ts  # structural views for the two seeded client modules
test/provider.test.mjs   # provider behavior; stubs globalThis.fetch
test/client.test.mjs     # evaluates the emitted lib/client.js (real React) against fake configForms/slots/credentials
test/wiring.test.mjs     # host apply(), compiled form surface, live config source, option precedence
scripts/build-client.mjs # esbuild bundler + CSS-modules plugin + ancesters client/source alias
tsconfig.json            # host emit (src/index|provider|host/** → lib/)
src/client/tsconfig.json # browser typecheck (noEmit)
cordis.patch.yml         # Bundle layer (dsh.bundle.patch): activates plugin + switches searchProvider
types/client.d.ts        # hand-maintained types for the emitted bundle (lib/client.js emits none)
```

`package.json` exposes three entries: `.` (the plugin), `./provider` (the class
and mapping, reusable without the plugin), and `./client` (the browser bundle,
declared by `dsh.client` so the Host serves it at
`/plugins/.../client.js`). The harness packages are `peerDependencies`
(resolved against the user's profile); the own dependencies are
`@comecaramelos/dsh-ancesters` and `@deepseek-ai/schemastery`. TypeScript,
esbuild, postcss, React (client test only) and the dsh packages pinned to one
0.2 release train (`0.2.0-rc.2`, so the prerelease peers resolve consistently)
are devDependencies (build/test only, never shipped).

## Architecture (understand before touching code)

### Registration flow (`src/host/apply.ts`)

Since dsh 0.2 there is no settings namespace (`installSection` is gone): the
row config **is** the configuration form. Every `Config` field is
`.volatile()` — an entry with no volatile field answers no form at all, and a
write naming a non-volatile field is refused — so `apply` receives live
references, keyed by the row's profile entry id (`web-search-searxng`).

`apply(ctx, config)`:
1. `attachConfigForm(ctx)` (`src/host/settings.ts`) — ancesters'
   `attachSettingsForm` with `userFields: CONFIG_FIELDS`, `liveKeys: []`. It
   reads the entry id off `ctx.fiber.entry.options.id` (a bare mount logs once
   and keeps searching), waits for the optional `settings` service through
   `ctx.inject(["settings"], …)`, and keeps the generated page off with one
   disposable `settings.configure({ auto: false }, fiber)` — the card is the page.
2. `ctx.web.registerSearchProvider(new SearxngSearchProvider(() => resolveOptions(ctx, configSource(config)())))`
   — `configSource` reads every live reference (`readVolatile`, which also
   accepts plain values composed by hand) **per search**, so a form commit takes
   effect on the *next* search without re-registering the provider. Never
   capture a value in `apply`.

With no settings service mounted the inject callback never fires and the
references keep answering the row — the plugin keeps running exactly as
composed. Same idiom as the harness's own `dsh-web-search-deepseek` 0.2
(`config.x.get()` per search); do not declare `settings` in the plugin's own
`inject` (that would make an optional dependency mandatory).

### Option resolution (`resolveOptions`)

Priority: **form → env var → constant**. The provider never sees missing
values (everything arrives fully defaulted). `baseURL`, `maxResults` and
`language` carry **no schema default** on purpose: a schema default would answer
before the environment and hide `SEARXNG_*` for good.

| Option | Env var | Default |
|---|---|---|
| `baseURL` | `SEARXNG_BASE_URL` | `http://localhost:8080` |
| `maxResults` | `SEARXNG_MAX_RESULTS` | `10` |
| `language` | `SEARXNG_LANGUAGE` | `"all"` (omits the parameter) |
| `apiKey` (literal, `role('secret')`) | — | omitted |
| `apiKeyEnv` (`role('credential-ref')`) | — | `SEARXNG_API_KEY` |

The API key is resolved **per search**: `ctx.credentials.resolve(ref)` if the
seam exists, otherwise `launchEnvironmentOf(ctx)`. Absent = valid (keyless
local SearXNG).

### Search (`SearxngSearchProvider.search`)

- Options snapshot on entry (a settings change applies to the next search).
- URL: `{baseURL}/search?q=...&format=json[&count=N][&language=...]`.
  `count` is a cost/latency optimization; the seam re-applies its own
  `maxResults` on the way back (hence `truncated: false` always).
- Headers: browser UA (anti-botdetection), `x-forwarded-for: 127.0.0.1`
  (local rate-limit bypass, see Gotchas), `authorization: Bearer` only with a key.
- `redirect: "follow"` (SearXNG may 307).
- `recordRequest` appends the `web/searxng-search-request` session event
  (endpoint + query, **secret-free**) only when there is an initiating Agent.

### Result mapping

- `url` ← `url` (required; entries without a URL are dropped).
- `title` ← `title`, `snippet` ← `content`, `publishedAt` ← `publishedDate`
  (only when non-empty strings; **never invent fields**).
- Dedup by URL, preserving relevance order.
- The result's `content` is **always omitted** (SearXNG generates no answer).

## Conventions

- TypeScript sources, emitted ESM (`type: module`); no own runtime dependency
  beyond `schemastery`. `tsconfig.json` (host) and
  `src/client/tsconfig.json` (browser, `noEmit`) are separate: the browser half
  never emits, it is typechecked and then bundled.
- `src/client/**` imports the seed modules through
  `scripts/build-client.mjs`'s `external` list; anything else bundled in fails at
  import. Stylesheets travel as `*.module.css` files, never inline `<style>`
  strings in the source.
- Tests: `node:test` + `node:assert/strict`, run against **emitted** `lib/**`
  (`npm test` builds first via `pretest`). `globalThis.fetch` stub
  (save/restore in `beforeEach`/`afterEach`). Zero test-only dependencies.
- JSDoc in English in the code; provider error messages start with
  "SearXNG ...".
- Web profiles **disable HMR**: after editing `cordis.patch.yml` the DSH
  process must be restarted.

## Errors

This package only emits two `WebError` codes:
- `WEB_PROVIDER_ERROR` — network failure, non-2xx (extract `message`/`error`
  from the JSON body when possible), unprocessable body, credential failure.
- `WEB_ABORTED` — caller cancellation (normalize every abort to this, keeping
  `signal.reason` as `cause`).

Selection codes (`WEB_PROVIDER_UNAVAILABLE`, `WEB_PROVIDER_AMBIGUOUS`,
`WEB_DUPLICATE_PROVIDER`, ...) are emitted by the `WebRuntime` seam, not this
package. `available()` must stay a **local, network-free** check
(`baseURL` parse + positive-integer `maxResults`).

## Gotchas

- **SearXNG rate limit on Docker Desktop**: the host arrives as the compose
  gateway IP (e.g. `172.18.0.1`) and the limiter 429s the JSON API
  (`API_MAX = 4/hour`). The `X-Forwarded-For: 127.0.0.1` header +
  `trusted_proxies = ['127.0.0.0/8']` + `pass_ip` in `limiter.toml` avoids it.
  **Do not remove that header** without reading the README's "Rate-limit note";
  for remote instances it is adjusted on the server, not here.
- **Secrets**: `apiKey` carries `role('secret')` and must never ride a
  `describe()`. Prefer `apiKeyEnv` + `ctx.credentials` over literals. The
  browser page follows suit: the key control is write-only (blank = keep),
  is staged in its own `KeyController` (never in the ancesters controller — a
  staged `apiKey` would be written into the profile patch by `applyStaged`),
  writes through `remote.credentials` addressed by the form's `apiKeyEnv`, and
  re-reads on `credentials/reference-updated`.
- **Client bundle edges**: the emitted `lib/client.js` may only *require*
  platform seed words (the runtime module table cannot answer anything else; a
  require that misses the table fails the plugin's loader entry at import). The
  source half keeps that contract by importing nothing but those ids
  (`src/client/**` imports the `dsh-client-store` face through
  `src/client/shell-modules.d.ts`, described not installed) plus
  `@comecaramelos/dsh-ancesters/client`, which `scripts/build-client.mjs`
  aliases to its plain-ESM `client/source` and bundles in (it requires only the
  same seed words). Cross-plugin collaboration goes through cordis services
  (`ctx.configForms`, `ctx.slots`, `ctx.locale`, `ctx.remote`).
- **The card stands on the bundle's own page** (dsh 0.2, same as
  `dsh-hover-information`): `placement: "bundle"` makes ancesters register it
  into `plugins.bundle.config` keyed by the package name
  (`@comecaramelos/dsh-web-search-searxng` — this plugin is its own bundle, so
  no `bundleId`). Clicking the plugin in the Plugins list opens the form
  directly, like the built-in Web search entry; the `web-search-searxng`
  component row still lists below it, with no configure link. That page asks
  for the `page` shape only (no `renderSummary`: the line under the title is the
  package description). The Plugins page draws the container (crumb, title,
  description); the body draws only fields and the Save/Discard footer — no card
  shell, no disclosure header. `placement` is new in ancesters (Unreleased).
  The shipped DeepSeek "Web search" page is a separate official `plugins.item`
  entry (id `web-search`), so the 0.1 tombstone over `settings.plugin.item` is
  gone and must not come back: nothing here collides with it any more. Do NOT
  port per-request search-budget fields from other providers (e.g. `maxUses`):
  SearXNG's search API has no such parameter, so it would be a dead setting.
- **No `config:` on the bundle row** in `cordis.patch.yml`: under dsh 0.2 the
  row's `config:` is the form's base layer, and whatever it declares comes back
  as a user-layer value (an Overridden badge) after one unrelated save. The old
  `!!js process.env.X ?? default` pattern is therefore gone; the environment
  fallback lives in `resolveOptions` instead. Keep new options that way.
- **Locale ids**: dictionaries register under `en` / `zh` only — dsh never reads
  `en-US`. The plugin's keys merge over ancesters' shared namespace and win.
- Do not add `content` to the result or `truncated: true`: the seam owns both.

## Installation (debugging context)

- Source bundle (debug mount), from a WSL **login** shell (`bash -l`, so dsh
  spawns the Linux `pnpm`):
  `dsh plugin --profile plugin-dev add @comecaramelos/dsh-web-search-searxng@link:/home/roberto/dev/dsh/dsh-web-search-searxng`
  — name the package before `link:`; a bare `link:<dir>` is keyed by the folder
  name and dsh then cannot resolve the bundle (the add is rolled back). Then
  enable the bundle (Plugins page, or `dsh.profile.bundles`); its patch switches
  `web.config.searchProvider: searxng-local`. Local sources mount only in
  `plugin-dev` — the live `web` profile consumes the bundled/npm version, never
  this checkout.
- Smoke test without touching real profiles: point `DSH_HOME` at a throwaway
  WSL-native directory (not `/mnt/c` — pnpm symlinks break there), create a
  profile with `--from-default-profile web`, add as above, then
  `dsh <profile> --dump-config` and `dsh <profile> --no-open`.
- Manual: symlink in `$DSH_HOME/profiles/node_modules/@comecaramelos/` + entry in
  the profile's `cordis.patch.yml` (see README).
