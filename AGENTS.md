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
src/host/schema.ts       # Config (schemastery) + the Config type
src/host/settings.ts     # installSection: namespace + live `ConfigSource` thunk
src/host/apply.ts        # apply(ctx, config): section source + provider registration
src/host/values.ts       # resolveOptions: settings → env → constant
src/host/credentials.ts  # apiKeyRef/apiKeyEnvName + the per-search key thunk
src/host/recorder.ts     # the secret-free `web/searxng-search-request` session event
src/host/request.ts      # buildSearchRequest: URL + headers
src/host/provider.ts     # SearxngSearchProvider
src/host/mapping.ts      # mapSearxngResult / mapSearxngResponse
src/host/abort.ts        # abort helpers, all normalized to WEB_ABORTED
src/host/types/          # shared type sections (config / search / services)
src/client/index.ts      # browser surface: apply + inject
src/client/apply.ts      # browser wiring: styles, locale, scope, controller, slots
src/client/plugin-meta.ts# plugin id, namespace(s), inject list
src/client/controller/   # form.ts (staged form), fields.ts (specs), state.ts, index.ts
src/client/card/         # index.ts (card), fields.ts (ValueField/SecretField), tombstone.ts
src/client/styles/       # SearxngCard.module.css + one-shot injection + css-modules.d.ts
src/client/locales/      # en-US / zh-CN dictionaries
src/client/shell-modules.d.ts  # structural views for the two seeded client modules
test/provider.test.mjs   # provider behavior; stubs globalThis.fetch
test/client.test.mjs     # evaluates the emitted lib/client.js in a simulated module loader
test/wiring.test.mjs     # host apply(), settings projection, option precedence
scripts/build-client.mjs # esbuild bundler + CSS-modules plugin for the browser half
tsconfig.json            # host emit (src/index|provider|host/** → lib/)
src/client/tsconfig.json # browser typecheck (noEmit)
cordis.patch.yml         # Bundle layer (dsh.bundle.patch): activates plugin + switches searchProvider
types/client.d.ts        # hand-maintained types for the emitted bundle (lib/client.js emits none)
```

`package.json` exposes three entries: `.` (the plugin), `./provider` (the class
and mapping, reusable without the plugin), and `./client` (the browser bundle,
declared by `dsh.client` so the Host serves it at
`/plugins/.../client.js`). The harness packages are `peerDependencies`
(resolved against the user's profile); the only own dependency is
`@deepseek-ai/schemastery`. TypeScript, esbuild and postcss are devDependencies
(build only, never shipped).

## Architecture (understand before touching code)

### Registration flow (`src/host/apply.ts`)

`apply(ctx, config)`:
1. `installSection(ctx, config, (source) => { current = source; })`
   (`src/host/settings.ts`) — it waits for the optional `settings` service
   through `ctx.inject(["settings"], …)` and calls
   `settingsCtx.settings.installSection(ctx, "web-search-searxng", Config, config, …)`.
   The section is **projected per call** via the `current` thunk: a settings
   change takes effect on the *next* search without re-registering the provider.
2. `ctx.web.registerSearchProvider(new SearxngSearchProvider(() => resolveOptions(ctx, current())))`.

With no settings provider mounted the inject callback never fires and `current`
stays the row config — the plugin keeps running exactly as composed. This is the
same idiom the harness's own `dsh-web-search-deepseek` provider uses; do not
declare `settings` in the plugin's own `inject` (that would make an optional
dependency mandatory).

### Option resolution (`resolveOptions`)

Priority: **settings → env var → constant**. The provider never sees missing
values (everything arrives fully defaulted).

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
  browser card follows suit: the key control is write-only (blank = keep),
  writes through the credentials domain addressed by `apiKeyEnv`, and re-reads
  on `credentials/reference-updated`.
- **Client bundle edges**: the emitted `lib/client.js` may only *require*
  platform seed words (the runtime module table cannot answer anything else; a
  require that misses the table fails the plugin's loader entry at import). The
  source half keeps that contract by importing nothing but those ids
  (`src/client/**` imports the two `dsh-client-*` faces through
  `src/client/shell-modules.d.ts`, described not installed) and by the
  `external` list in `scripts/build-client.mjs`. Cross-plugin collaboration goes
  through
  cordis services (`ctx.settingsScope`, `ctx.slots`, `ctx.locale`,
  `ctx.remote`); the card owns its chrome and staging — do not import
  `dsh-client-ui-settings-plugins` values.
- **The card takes the shipped card's seat**: the configurable-plugins tab
  builds its cell list from the keys of entries registered into
  `settings.plugin.item` (∩ the namespaces the Host serves) WITHOUT deduping,
  so any second entry claiming the `web-search-deepseek` key with a visible
  component renders that cell twice. The bundle therefore registers a
  **null-rendering tombstone** under the `web-search-deepseek` key at
  priority -1 (keyed dispatch renders the lowest priority; the shipped card
  registers at 0), leaving the DeepSeek section its seat but no card, and
  registers the card itself — which keeps the shipped card's shape (its
  disclosure header, its fields, its staged-save footer), names its copy after
  SearXNG, and draws them with the modern card sheet the sibling cards share
  (`dsh-chrome-mcp`, `dsh-docker-desktop-mcp`, `dsh-hover-information`:
  16px hairline shell, two-row `.field`, filled 32px input, outline buttons) —
  and edits ONLY the `web-search-searxng` namespace — under its own
  `web-search-searxng` key, rendered whenever the section is available. Dropping the tombstone re-surfaces the shipped DeepSeek card
  next to the SearXNG one; dropping the card entry leaves the section with
  no card at all. The DeepSeek provider itself stays untouched (still
  selectable via `web.config.searchProvider`). Do NOT port per-request
  search-budget fields from other providers into the SearXNG section (e.g.
  `maxUses`): SearXNG's search API has no such parameter, so it would be a
  dead setting the provider never reads.
- `cordis.patch.yml` uses `!!js process.env.X ?? default` to stay
  environment-first; keep that pattern when adding options.
- Do not add `content` to the result or `truncated: true`: the seam owns both.

## Installation (debugging context)

- Source bundle (debug mount): `dsh plugin --profile plugin-dev add link:/home/roberto/dev/dsh/dsh-web-search-searxng`
  (links this checkout as a profile layer and switches `web.config.searchProvider: searxng-local`).
  Local sources mount only in `plugin-dev` — the live `web` profile consumes the
  bundled/npm version, never this checkout.
- Manual: symlink in `$DSH_HOME/profiles/node_modules/@deepseek-ai/` + entry in
  the profile's `cordis.patch.yml` (see README).
