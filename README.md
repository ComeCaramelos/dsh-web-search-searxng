# @deepseek-ai/dsh-web-search-searxng

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
- DeepSeek Harness profile with the `web` seam mounted (every standard profile ships it).

## Install

### One-command install (bundle)

The package ships a `dsh.bundle.patch` declaration (`cordis.patch.yml`), so a
single `dsh plugin add` registers the plugin **and** switches the web seam to
it — no YAML editing:

```bash
dsh plugin --profile web add /path/to/dsh-web-search-searxng
```

Configuration is environment-first — set these before launching `dsh` and no
config editing is required at all:

```bash
export SEARXNG_BASE_URL=http://localhost:8080   # optional; default http://localhost:8080
export SEARXNG_MAX_RESULTS=10                    # optional; default 10
export SEARXNG_LANGUAGE=en                       # optional; 'all' (no param) by default
```

### Manual install (local development)

```bash
# 1. Make the package resolvable from the profile's node_modules
ln -sfn /path/to/dsh-web-search-searxng \
        "$DSH_HOME/profiles/node_modules/@deepseek-ai/dsh-web-search-searxng"

# 2. Register the plugin and switch the search provider in cordis.patch.yml:
```

```yaml
- insert:
    - id: web-search-searxng
      name: '@deepseek-ai/dsh-web-search-searxng'
      config:
        baseURL: http://localhost:8080
        maxResults: 10

- id: web
  config:
    searchProvider: searxng-local
```

Restart the DSH process (or the GUI) for the patch to take effect.

> Web profiles disable HMR reload by design; after editing `cordis.patch.yml` a process restart is required.

## Tests

```bash
npm test   # = node --test tests/provider.spec.js tests/client.spec.js (35 tests, zero dependencies)
```

`tests/client.spec.js` evaluates `lib/client.js` in a simulated client module
loader (stubbed seed modules + settings scope + credentials face) and covers
the factory's module edges, the `apply()` wiring, and the card's staging,
validation, saving, and credential handling.

## Config

| Key | Default | Meaning |
|---|---|---|
| `baseURL` | `http://localhost:8080` | SearXNG base URL; `/search` is appended. Falls back to `$SEARXNG_BASE_URL` from any environment layer. An unparseable value makes the provider unavailable. |
| `maxResults` | `10` | Upper bound on sources returned by one search (the seam also enforces its own bound). |
| `language` | `all` | Search language sent as `language=...` (e.g. `en`, `zh-CN`). `'all'` (or unset) omits the parameter entirely. Falls back to `$SEARXNG_LANGUAGE`. |
| `apiKey` | omitted | Literal SearXNG API key, when your instance requires one. Prefer `apiKeyEnv` so no secret enters configuration; a non-empty literal wins. |
| `apiKeyEnv` | `SEARXNG_API_KEY` | Credential reference resolved per search through `ctx.credentials`, or from the process environment when that seam is absent. A missing value is fine for keyless local instances. |

```yaml
- id: web-search-searxng
  name: '@deepseek-ai/dsh-web-search-searxng'
  config:
    baseURL: http://localhost:8080
    maxResults: 10
    language: en
```

The entry above is the base layer of the `web-search-searxng` Settings section: a user layer over it reaches the NEXT search, because the provider projects the section per call rather than capturing it at registration. `apiKey` carries `role('secret')`, so it never rides a `describe()` response in any layer.

## Web UI settings card

The package also ships a **browser half** (`lib/client.js`, declared by
`dsh.client` in `package.json`): the Web-search card in the Web UI's
**Settings → Plugins → Plugin configuration** tab, where every value above can
be edited.

The card keeps the look of the "Web search" card the harness ships for the
`web-search-deepseek` namespace in `dsh-client-ui-settings-plugins` — same
chrome, same field design — with its texts updated to name the SearXNG
provider it edits (title "SearXNG", description "The SearXNG meta-search
provider."). Rather than appearing as a second card next to the shipped one,
the bundle takes over that seat: a null-rendering tombstone registered under
the `web-search-deepseek` key at priority -1 shadows the shipped card (keyed
slots render the lowest priority), and the card itself — which edits the
`web-search-searxng` section — registers under its own key:

| Card field | Section key | Behavior |
|---|---|---|
| API key | credentials domain | Write-only control — the literal never rides a response; blank keeps the stored key. A key is optional for keyless instances. The badge reports whether a key is configured, and re-reads on `credentials/reference-updated`. The write addresses the reference the section's `apiKeyEnv` names (default `SEARXNG_API_KEY`) — that option is configuration-level, not a card field. |
| Endpoint | `baseURL` | SearXNG base URL; blank re-inherits the composed value, then the default. |
| Max results | `maxResults` | Whole number ≥ 1; invalid drafts block the save. |
| Language | `language` | Blank re-inherits; `'all'` omits the parameter. |

The card stages edits and writes them only on **Save**: each field is a
revision-fenced document mutation over the `web-search-searxng` settings
namespace; an **Overridden** badge marks fields the user layer carries (with a
reset back to the composed value); a save the Host did not accept keeps its
drafts for correction. Changes take effect on the NEXT search — no restart.

The bundle registers into the shared `settings.plugin.item` slot twice: the
null-rendering tombstone under `web-search-deepseek` (which keeps the DeepSeek
section's seat but shows no card), and the card itself under its own
`web-search-searxng` key, rendered whenever the section is available — so a
deployment without the DeepSeek provider (e.g. with the `web-search-deepseek`
row disabled in its profile) still reaches the SearXNG settings. The tab
builds its cell list from the registered entry keys it serves, so the tombstone
must render nothing: a visible component there would appear a second time,
once per entry claiming the key. The tab dispatches a key only when the Host
serves its namespace, so a deployment without this plugin shows no trace of
the card either way. The DeepSeek provider itself stays untouched: it is still
selectable through `web.config.searchProvider`, it just has no card anymore.

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
