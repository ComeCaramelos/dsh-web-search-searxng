/**
 * Host half — the row's configuration form: what the Web GUI edits.
 *
 * Since dsh 0.2 there is no settings namespace to install: the card edits the
 * **bundle row's own configuration**, served as a profile configuration form
 * keyed by the row's profile entry id, with the row config as its base layer and
 * the profile patch as its user layer. Every field is `.volatile()`
 * (./schema.ts), so `apply` receives live references and a form commit reaches
 * the *next* search without remounting the provider.
 *
 * The machinery is `@comecaramelos/dsh-ancesters`' `attachSettingsForm`, which
 * owns the three invariants every card needs: identity read off this fiber's own
 * loader entry, the generated page kept off with one disposable
 * `settings.configure({ auto: false }, fiber)` per fiber (the card is the page),
 * and commit routing by field. What is declared here is only this row's shape:
 *
 * - **Every field is user-authored** (`CONFIG_FIELDS`), and there is **no live
 *   mirror** (`liveKeys: []`): nothing the Host learns rides the form.
 * - **No commit routing and no triggers**: the provider reads the volatile
 *   references at dispatch, so a commit has nothing to re-judge.
 *
 * With no settings service mounted the inject inside never fires, and the
 * references keep answering what the row was composed with — the provider runs
 * exactly as before.
 */
import { attachSettingsForm, readVolatile, type AdapterContext } from "@comecaramelos/dsh-ancesters/host";
import { CONFIG_FIELDS } from "./constants.js";
import type { Config, ConfigValues } from "./schema.js";
import type { PluginContext } from "./types/index.js";

/** A config source: "what does the next search run on?". */
export type ConfigSource = () => ConfigValues;

/**
 * Attach this row's configuration form for as long as this instance lives (the
 * form, and the generated page it keeps off, dispose with the fiber).
 * @param ctx - the plugin context owning the wiring.
 */
export function attachConfigForm(ctx: PluginContext): void {
    attachSettingsForm(ctx as unknown as AdapterContext, {
        name: "web-search-searxng",
        userFields: CONFIG_FIELDS,
        liveKeys: []
    });
}

/**
 * The thunk every search reads through: one read of every live reference.
 *
 * Never a captured snapshot — the references are what a form commit moves, so
 * reading them at dispatch is what lets a GUI edit reach the wire on the next
 * search. A field composed by hand as a plain value reads as itself.
 * @param config - the row config as `apply` received it.
 */
export function configSource(config: Config | undefined): ConfigSource {
    return () => ({
        apiKey: readVolatile<string | undefined>(config?.apiKey, undefined),
        apiKeyEnv: readVolatile<string | undefined>(config?.apiKeyEnv, undefined),
        baseURL: readVolatile<string | undefined>(config?.baseURL, undefined),
        maxResults: readVolatile<number | undefined>(config?.maxResults, undefined),
        language: readVolatile<string | undefined>(config?.language, undefined)
    });
}
