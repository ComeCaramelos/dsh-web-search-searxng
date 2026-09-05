/**
 * Host half — the wiring.
 *
 * `apply` is the only host module that knows the parts exist, and it does
 * almost nothing: hand the settings section the live config source, then register
 * one provider that reads that source afresh per search. Everything the
 * provider does is described behind it — option resolution in
 * {@link ./values.ts values}, credentials in {@link ./credentials.ts
 * credentials}, the request in {@link ./request.ts request}, the mapping in
 * {@link ./mapping.ts mapping}, cancellation in {@link ./abort.ts abort}.
 *
 * Two ordering rules that must survive any future edit:
 *
 *   - Register the section *before* the provider. The provider only ever reads
 *     through the source, and a source that never got installed is the row
 *     config — still correct, but the first search would then miss a GUI edit
 *     that landed before the provider existed.
 *   - Never capture a config here. `current` starts as the row config and is
 *     replaced by the live projection as soon as the settings service attaches;
 *     the provider thunk closes over `current`, so a settings change takes effect
 *     on the *next* search without re-registering anything.
 *
 * One instance per host: the settings namespace is fixed.
 */
import { SearxngSearchProvider } from "./provider.js";
import { installSection } from "./settings.js";
import type { Config } from "./schema.js";
import type { ConfigSource } from "./settings.js";
import type { PluginContext } from "./types/index.js";
import { resolveOptions } from "./values.js";

/**
 * Register the SearXNG search provider with `ctx.web`.
 * @param ctx - the plugin context.
 * @param config - the validated row config.
 */
export function apply(ctx: PluginContext, config: Config): void {
    let current: ConfigSource = () => config;
    installSection(ctx, config, (source) => {
        current = source;
    });
    ctx.web.registerSearchProvider(new SearxngSearchProvider(() => resolveOptions(ctx, current())));
}
