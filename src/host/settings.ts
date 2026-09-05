/**
 * Host half — the settings section: what the Web GUI edits.
 *
 * `SettingsProvider.installSection` is the canonical optional-settings wiring:
 * while a settings service is mounted it registers this plugin's namespace with
 * the composition entry as the `base` layer, routes committed writes back through
 * the plugin, and hands the resolved scope to `setSource`. This module owns one
 * decision on top of that wiring: making the source a *thunk* rather than a
 * captured snapshot.
 *
 * The dependency is optional, so it is taken through `ctx.inject(["settings"], …)`
 * rather than declared at the plugin's top level: in a composition that mounts no
 * settings provider the callback never fires, and `current` stays the row config —
 * which is exactly what the plugin was composed with. The sibling provider the
 * harness ships wires its own namespace the same way.
 *
 * The projection rule is the whole point. Cordis runs the callback after `apply`
 * returns, and a GUI edit lands whenever the user saves, so the provider must
 * consult the source afresh on every search. A captured config would pin every
 * search to the value the process booted with, and no GUI change would ever reach
 * the wire. `onChange` therefore does nothing: there is no registration-level fact
 * to re-judge — the seam re-reads at dispatch.
 */
import type { Context } from "@deepseek-ai/cordis";
import type { SettingsProvider } from "@deepseek-ai/dsh-settings";
import { SETTINGS_NAMESPACE } from "./constants.js";
import { Config } from "./schema.js";
import type { PluginContext } from "./types/index.js";

/** A config source: "what does the next search run on?". */
export type ConfigSource = () => Config;

/**
 * Install the settings section, handing `useSource` the live projection.
 * @param ctx - the plugin context owning the wiring.
 * @param config - the composition entry's config, used as the section's base layer.
 * @param useSource - receives the thunk every search reads through.
 */
export function installSection(ctx: PluginContext, config: Config, useSource: (current: ConfigSource) => void): void {
    // Cordis calls a function plugin back with its context; here that context
    // carries the `settings` seam the inject above waited for, narrowed to the
    // one provider this module calls.
    ctx.inject(["settings"], (settingsCtx: Context & { settings?: SettingsProvider }) => {
        settingsCtx.settings?.installSection(ctx, SETTINGS_NAMESPACE, Config, config, {
            setSource: (current: ConfigSource) => useSource(current),
            onChange: () => {
                /* Nothing to re-judge: the provider re-reads the source on every search. */
            }
        });
    });
}
