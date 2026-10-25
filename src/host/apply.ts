/**
 * Host half — the wiring.
 *
 * `apply` is the only host module that knows the parts exist, and it does
 * almost nothing: attach the row's configuration form, then register one
 * provider that reads the row's live references afresh per search. Everything
 * the provider does is described behind it — option resolution in
 * {@link ./values.ts values}, credentials in {@link ./credentials.ts
 * credentials}, the request in {@link ./request.ts request}, the mapping in
 * {@link ./mapping.ts mapping}, cancellation in {@link ./abort.ts abort}.
 *
 * One rule that must survive any future edit: never capture a config value
 * here. Every field is `.volatile()`, so `config` holds live references a form
 * commit moves; the provider thunk reads them at dispatch, which is what makes a
 * GUI edit take effect on the *next* search without re-registering anything.
 *
 * One instance per host: the row's entry id is fixed.
 */
import { SearxngSearchProvider } from "./provider.js";
import { attachConfigForm, configSource } from "./settings.js";
import type { Config } from "./schema.js";
import type { PluginContext } from "./types/index.js";
import { resolveOptions } from "./values.js";

/**
 * Register the SearXNG search provider with `ctx.web`.
 * @param ctx - the plugin context.
 * @param config - the validated row config (live references since dsh 0.2).
 */
export function apply(ctx: PluginContext, config: Config): void {
    attachConfigForm(ctx);
    const current = configSource(config);
    ctx.web.registerSearchProvider(new SearxngSearchProvider(() => resolveOptions(ctx, current())));
}
