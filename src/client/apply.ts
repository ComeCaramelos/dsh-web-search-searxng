/**
 * Browser half — the plugin body.
 *
 * The entry the loader calls: bind the namespace scope behind the controller,
 * register the card's dictionaries under the locale namespace, keep the
 * credential reference honest by re-reading it when the Host announces a change,
 * and mount two cells into the plugin-configuration slot.
 *
 * The two registrations are what the tab's key dispatch sees:
 *
 *   - a null-rendering tombstone claiming `web-search-deepseek` at priority -1,
 *     so the harness-shipped DeepSeek card keeps its seat but draws nothing
 *     beside ours (a keyed slot renders its lowest priority first);
 *   - the card itself, claiming `web-search-searxng`, rendered whenever that
 *     namespace is served.
 *
 * Every other module here is a dependency of this one, never the reverse.
 */
import { LOCALE_NAMESPACE, SETTINGS_NAMESPACE, DEEPSEEK_SETTINGS_NAMESPACE } from "./plugin-meta.js";
import { DICTIONARIES } from "./locales/index.js";
import { injectCardStyles } from "./styles/index.js";
import { SearxngCardController } from "./controller/index.js";
import { SearxngCard } from "./card/index.js";
import { SearxngTombstone } from "./card/tombstone.js";

/**
 * Mount the SearXNG web-search card.
 * @param ctx - the browser plugin context (slots, locale, remote, settingsScope).
 */
export function apply(ctx: any): void {
    // Styles first: the slot may render on the same turn, and the injection is
    // guarded by the tag's data-plugin-css marker, so a re-apply is a no-op.
    injectCardStyles();
    // Bind before registering: every `t(...)` the card reads resolves through
    // this namespace, and registering alone would leave the strings unbound until
    // the dictionaries land.
    ctx.locale.bind(LOCALE_NAMESPACE);
    ctx.effect(
        () => ctx.locale.register(LOCALE_NAMESPACE, DICTIONARIES),
        `${LOCALE_NAMESPACE}: card dictionaries`
    );

    const scope = ctx.settingsScope.bind({ namespace: SETTINGS_NAMESPACE });
    const controller = new SearxngCardController(scope, ctx.remote);

    ctx.effect(
        () => ctx.remote.$on("credentials/reference-updated", (ref: string) => controller.refreshCredential(ref)),
        `${LOCALE_NAMESPACE}: credential invalidations`
    );

    ctx.slots.inject("settings.plugin.item", function* () {
        yield ctx.slots.register(
            {
                name: "settings.plugin.item",
                key: DEEPSEEK_SETTINGS_NAMESPACE,
                priority: -1,
                locale: LOCALE_NAMESPACE
            },
            SearxngTombstone
        );
        yield ctx.slots.register(
            {
                name: "settings.plugin.item",
                key: SETTINGS_NAMESPACE,
                locale: LOCALE_NAMESPACE,
                inject: () => controller.inject()
            },
            SearxngCard
        );
    });
}
