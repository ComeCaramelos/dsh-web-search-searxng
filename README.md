# @comecaramelos/dsh-web-search-searxng

English | [中文](README.zh.md)

A [SearXNG](https://docs.searxng.org/)-backed `WebSearchProvider` for the DeepSeek Harness [web capability seam](https://github.com/deepseek-ai/deepseek-harness) (`ctx.web`). It calls a SearXNG instance's JSON API (`/search?format=json`) and maps the aggregated results into the seam's normalized `WebSearchResult`.

This is an **implementation** package: it registers a provider into `ctx.web`, resolves an optional API key through `ctx.credentials` or the process environment, records the auxiliary request in the initiating Agent session when one exists, and does not register a model-facing tool. It is a function/namespace plugin (`inject: ['web']`).

## Why SearXNG

- **Self-hosted & private**: your queries go to your own instance, not a third-party search vendor.
- **Zero per-search model cost**: unlike provider-backed search that issues a full model call, one search is a single HTTP GET — cheap and fast.
- **Multi-engine aggregation**: SearXNG merges Bing, Brave, Baidu, Google, DuckDuckGo, … behind one endpoint.
- **Portable**: point `baseURL` at any SearXNG — local Docker, a LAN instance, or a public one.

## Requirements

- A running SearXNG instance reachable from the DSH host (default `http://localhost:8080`).
- DeepSeek Harness **`^0.2.0`** (every 0.2 build, release candidates included —
  `engines.dsh: "^0.2.0-0"`), with the `web` seam mounted (every standard
  profile ships it). Versions `0.5.x` of this package are the last ones for
  dsh 0.1.
- [`@comecaramelos/dsh-ancesters`](../dsh-ancesters) `^0.2.0`, the shared base
  layer that absorbs the dsh 0.2 configuration surface (row identity, the
  configuration form, the row page registration) so a dsh change is fixed there
  once. It is not on npm yet: development links the sibling checkout
  (`file:../dsh-ancesters`, see `devDependencies`).

## Layout

TypeScript sources under `src/`, emitted JavaScript under `lib/` (generated —
never hand-edit). The package is the usual two-halves DSH plugin:

```
src/index.ts             host surface: identity, config, apply, the provider
src/provider.ts          the provider alone, for reuse without a plugin row
src/host/apply.ts        the wiring: configuration form + provider registration
src/host/settings.ts     the form attach (dsh-ancesters) and the live config source
src/host/values.ts       option resolution: form → environment → constants
src/host/credentials.ts  the per-search API-key resolution
src/host/recorder.ts     the secret-free session event per request
src/host/request.ts      the URL and headers one search dispatches with
src/host/provider.ts     the provider class
src/host/mapping.ts      SearXNG response → normalized sources
src/host/abort.ts        cancellation, normalized to WEB_ABORTED
src/host/constants.ts    fixed identifiers, defaults, header constants
src/host/schema.ts       the row config schema — every field volatile, so it is also the form
src/client/**            the browser half, bundled into the one lib/client.js
```

The browser half compiles separately and is bundled by
`scripts/build-client.mjs` (esbuild) into `lib/client.js`: the shell fetches
exactly one script per plugin, so the source modules exist for readability, not
for the runtime graph. The shared card machinery
(`@comecaramelos/dsh-ancesters/client`) is bundled into that same file through
an alias to its plain-ESM `client/source` build, so the bundle still requires
nothing but the shell's seed modules.

## Install

### One-command install (bundle)

The package ships a `dsh.bundle.patch` declaration (`cordis.patch.yml`), so a
single `dsh plugin add` registers the plugin **and** switches the web seam to
it — no YAML editing. Link local sources only in the `plugin-dev` profile;
the live `web` profile consumes the bundled/npm version instead:

```bash
dsh plugin --profile plugin-dev add @comecaramelos/dsh-web-search-searxng@link:/home/roberto/dev/dsh/dsh-web-search-searxng
```

Name the package in front of `link:` — a bare `link:<dir>` is keyed by the
folder name, and dsh then cannot resolve the bundle by its package name. Run it
from a WSL login shell (`bash -l`) so dsh spawns the Linux `pnpm`, not a Windows
one found on an inherited `PATH`. Then enable the bundle on the Plugins page (or
list it under the profile's `dsh.profile.bundles`).

Configuration is environment-first — set these before launching `dsh` and no
config editing is required at all (a field the configuration card leaves
blank falls back to them for each search):

```bash
export SEARXNG_BASE_URL=http://localhost:8080   # optional; default http://localhost:8080
export SEARXNG_MAX_RESULTS=10                    # optional; default 10
export SEARXNG_LANGUAGE=en                       # optional; 'all' (no param) by default
```

### Manual install (local development)

```bash
# 1. Build the sources: `src/**` is TypeScript, `lib/**` is what the harness loads.
npm ci && npm run build

# 2. Make the package resolvable from the profile's node_modules
ln -sfn /path/to/dsh-web-search-searxng \
        "$DSH_HOME/profiles/node_modules/@comecaramelos/dsh-web-search-searxng"

# 3. Register the plugin and switch the search provider in cordis.patch.yml:
```

```yaml
- insert:
    - id: web-search-searxng
      name: '@comecaramelos/dsh-web-search-searxng'

- id: web
  config:
    searchProvider: searxng-local
    fetchProvider: http
```

The row id `web-search-searxng` is what the configuration form is keyed by, so
keep it as is.

Restart the DSH process (or the GUI) for the patch to take effect.

> Web profiles disable HMR reload by design; after editing `cordis.patch.yml` a process restart is required.

## Tests

```bash
npm test   # builds, then node --test test/*.test.mjs (68 tests)
```

The build has two halves: `tsc` compiles `src/host/**` into `lib/`, and
`tsc -p src/client/tsconfig.json` typechecks `src/client/**` before
`scripts/build-client.mjs` bundles that half with esbuild into the one
classic-script `lib/client.js` the shell fetches. `lib/` is generated output —
never hand-edit it.

`test/provider.test.mjs` drives the provider through the public `./provider`
surface with `globalThis.fetch` stubbed. `test/client.test.mjs` evaluates
`lib/client.js` through the client module loader contract (real React behind
the seed words, a fake configuration form, slots and credentials domain) and
covers the bundle's module edges, the `plugins.bundle.config` registration, the
page shape, and the staging, validation, saving and credential handling.
`test/wiring.test.mjs` covers the host `apply()`, the compiled configuration
form surface (every field volatile), the live config source and the
option-precedence chain. React and react-dom are devDependencies for the client
test only; the bundle uses the shell's own React.

## Config

| Key | Default | Meaning |
|---|---|---|
| `baseURL` | `http://localhost:8080` | SearXNG base URL; `/search` is appended. Unset falls back to `$SEARXNG_BASE_URL` from the launch environment, then the default. An unparseable value makes the provider unavailable. |
| `maxResults` | `10` | Upper bound on sources returned by one search (the seam also enforces its own bound). Unset falls back to `$SEARXNG_MAX_RESULTS`, then the default. |
| `language` | `all` | Search language sent as `language=...` (e.g. `en`, `zh-CN`). `'all'` (or unset) omits the parameter entirely. Unset falls back to `$SEARXNG_LANGUAGE`. |
| `apiKey` | omitted | Literal SearXNG API key, when your instance requires one. Prefer `apiKeyEnv` so no secret enters configuration; a non-empty literal wins. |
| `apiKeyEnv` | `SEARXNG_API_KEY` | Credential reference resolved per search through `ctx.credentials`, or from the process environment when that seam is absent. A missing value is fine for keyless local instances. |

Values can be set on the configuration card (below), or by hand in your
profile's own `cordis.patch.yml` — the same user layer the page writes:

```yaml
- id: web-search-searxng
  name: '@comecaramelos/dsh-web-search-searxng'
  config:
    baseURL: http://localhost:8080
    maxResults: 10
    language: en
```

Since dsh 0.2 there is no separate settings namespace: the row config **is**
the configuration form. Every field is `.volatile()`, the form is keyed by the
row's profile entry id (`web-search-searxng`), the row's own `config:` is its
base layer and the profile patch is its user layer. The provider reads the live
values for each search, so an edit reaches the NEXT search without a restart.
`apiKey` carries `role('secret')`, so it never rides a `describe()` response.

The shipped `cordis.patch.yml` deliberately declares **no** `config:` on the
row: under dsh 0.2 whatever the row declares is re-materialised as a user-layer
value by the next form write, so every field would come back "Overridden" after
one unrelated save. Leave a field unset and the environment fallback above
applies.

## Web UI configuration page

The package also ships a **browser half** (`lib/client.js`, declared by
`dsh.client` in `package.json`): the configuration card on this bundle's own
page in the Web UI's **Plugins** page — click `@comecaramelos/dsh-web-search-searxng`
in the list and the form is right there, the way the built-in Web search entry
opens, with no step into the `web-search-searxng` component (the component row
still lists below the form, with no configure link of its own). The Plugins
page draws the container — crumb, title, the package description — and the card
registers its body into the `plugins.bundle.config` slot under the package name
(ancesters' `placement: "bundle"`).

The page is built from `@comecaramelos/dsh-ancesters`' `mountSettingsCard`
(dictionaries, the controller over the row's form, the fenced write door, the
Overridden list, the slot registration); this package declares the descriptor
and one body block (`src/client/card/body.ts`): one credential field, three
value fields and a Save/Discard footer, drawn with the sibling cards' field
sheet (`src/client/styles/SearxngCard.module.css`).

| Field | Form key | Behavior |
|---|---|---|
| API key | credentials domain | Write-only control — the literal never rides the form or a response; blank keeps the stored key. A key is optional for keyless instances. The badge reports whether a key is configured, and re-reads on `credentials/reference-updated`. The write addresses the reference the form's `apiKeyEnv` names (default `SEARXNG_API_KEY`) — that option is configuration-level, not a page field. |
| Endpoint | `baseURL` | SearXNG base URL; blank falls back to `$SEARXNG_BASE_URL`, then the default. |
| Max results | `maxResults` | Whole number ≥ 1, written as a number; invalid drafts block the save. |
| Language | `language` | Blank falls back to `$SEARXNG_LANGUAGE`; `'all'` omits the parameter. |

The page stages edits and writes them only on **Save**; an **Overridden**
badge marks the fields the user layer carries, with **Reset to default** to drop
one back to the row's answer (blanking an overridden field and saving does the
same). A save the Host did not accept keeps its drafts for correction.

The shipped DeepSeek "Web search" page is a separate official entry on the same
Plugins page (`plugins.item`, id `web-search`); this package no longer shadows
it — the 0.1 tombstone over `settings.plugin.item` is gone. Both pages stay
reachable, and `web.config.searchProvider` (switched to `searxng-local` by the
bundle patch) decides which provider serves searches.

> The Host scans `dsh.client` declarations when the process starts, so after
> installing or upgrading to a version that carries the browser half, restart
> the DSH process (or the GUI) once. Web profiles disable HMR by design.

## Rate-limit note (local Docker behind Docker Desktop)

When SearXNG runs in Docker Desktop, requests from the host arrive with the compose **gateway IP** (e.g. `172.18.0.1`) as `REMOTE_ADDR`, not `127.0.0.1`. The SearXNG limiter would treat that as a foreign client and 429 the JSON API (`API_MAX = 4/hour`). This provider sends `X-Forwarded-For: 127.0.0.1` on every request; combined with `trusted_proxies = ['127.0.0.0/8']` and a `pass_ip` entry for the loopback and Docker bridge ranges in `limiter.toml`, the local client bypasses the JSON-API quota entirely.

If your SearXNG is remote (LAN/cloud), drop that header from the provider or adjust `trusted_proxies`/`pass_ip` on the server accordingly.

## Mapping

SearXNG returns no provider-generated answer content this provider trusts as `content`, so `content` is omitted. `sources[]` comes from `results[]`: `url` ← `url`, `title` ← `title`, `snippet` ← `content`, and `publishedAt` ← `publishedDate`. Results are deduplicated by URL.

Provider failures become `WEB_PROVIDER_ERROR`; caller cancellation becomes `WEB_ABORTED`. HTTP redirects are followed (SearXNG may 307 blob/redirect endpoints).

## Request logging

Immediately before dispatch, a search running under an initiating Agent appends the log-only `web/searxng-search-request` session event containing the resolved endpoint and query (secret-free). Direct programmatic provider calls outside an Agent have no initiating session to log.

## License

MIT
