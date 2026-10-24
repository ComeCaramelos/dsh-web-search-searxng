/**
 * @comecaramelos/dsh-web-search-searxng — browser half, public surface.
 *
 * The card is built from `@comecaramelos/dsh-ancesters`' `mountSettingsCard`:
 * the dictionaries, the controller over the row's configuration form (the
 * staged drafts, the fenced write door, the Overridden list) and the slot
 * registration all come from the shared half, so a dsh change to any of them is
 * fixed there, once. What is declared here is the descriptor, the one block it
 * draws (./card/body.ts) and the one thing the shared half has no hole for: the
 * API key, which never rides the form and is written through the credentials
 * domain instead (./controller/credentials.ts).
 *
 * The card stands on the **bundle's own page** (`placement: "bundle"` →
 * `plugins.bundle.config`, keyed by the package name): clicking the plugin in
 * the Plugins list opens the form directly, the way the built-in Web search
 * entry does, with no step into the `web-search-searxng` component (the
 * component row still lists below it, with no configure link of its own). The
 * shipped DeepSeek "Web search" page is an official `plugins.item` entry of its
 * own, so nothing here shadows it: both stay reachable, and
 * `web.config.searchProvider` decides which provider serves searches.
 *
 * The one module the bundler walks, so the emitted `client.js` exports exactly
 * what the shell consumes — `apply` and `inject` — plus the body's doors, on
 * the surface for the tests (the loader ignores them).
 */
import { mountSettingsCard, type SettingsCardSpec } from "@comecaramelos/dsh-ancesters/client";
import { SearxngBlock } from "./card/body.js";
import { KeyController, type CredentialsRemote } from "./controller/credentials.js";
import { DICTIONARIES } from "./locales/index.js";
import { ENTRY_ID, LOCALE_NAMESPACE, PLUGIN_ID, STAGED_FIELDS } from "./plugin-meta.js";
import { injectCardStyles } from "./styles/index.js";

/** The descriptor that makes this plugin's configuration card, around one key controller. */
function cardSpec(keys: () => KeyController | undefined): SettingsCardSpec {
    return {
        entryId: ENTRY_ID,
        pluginId: PLUGIN_ID,
        localeNamespace: LOCALE_NAMESPACE,
        locale: DICTIONARIES,
        fields: {
            // Every value is a draft until Save: a half-typed URL must never
            // reach the next search.
            staged: [...STAGED_FIELDS],
            immediate: [],
            triggers: [],
            // No mirror: nothing the Host learns rides the form.
            liveKeys: []
        },
        blocks: [
            {
                block: SearxngBlock as never,
                hideWhenUnavailable: true,
                bind: (_snapshot, controller) => ({ controller, keys: keys() })
            }
        ],
        // The footer states a refused save itself.
        errorLine: false,
        // The bundle's page is what the Plugins list opens. It asks for the
        // `page` shape only: the line under the title is the package description.
        placement: "bundle"
    };
}

/** The key controller each mounted context built (test surface, see below). */
const KEY_CONTROLLERS = new WeakMap<object, KeyController>();

/** Services the shell must resolve before `apply` runs: the card's own set,
 * plus the credentials domain the key control writes through. */
export const inject: readonly string[] = [...mountSettingsCard(cardSpec(() => undefined)).inject, "remote.credentials"];

/**
 * The loader entry: this page's own stylesheet (the shared machinery injects
 * only its sheet), the key controller over the credentials domain, then the
 * mounted card.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: any): void {
    injectCardStyles();
    let keys: KeyController | undefined;
    const card = mountSettingsCard(cardSpec(() => keys));
    // The key addresses whatever reference the form answers for `apiKeyEnv`,
    // so it reads the same form the card does.
    const form = ctx.configForms?.get(ENTRY_ID);
    const refOf = (): unknown => {
        const snapshot = form?.getSnapshot();
        return snapshot?.status === "ready" ? snapshot.value?.apiKeyEnv : undefined;
    };
    keys = new KeyController(ctx.remote as CredentialsRemote | undefined, refOf);
    const controller = keys;
    KEY_CONTROLLERS.set(ctx, controller);
    ctx.effect(() => {
        void controller.refresh();
        // The reference lives in the form, so every form change may move it.
        return form?.subscribe(() => {
            void controller.refresh();
        });
    }, `${LOCALE_NAMESPACE}: credential reference`);
    ctx.effect(
        () => ctx.remote?.$on?.("credentials/reference-updated", (ref: string) => controller.announce(ref)),
        `${LOCALE_NAMESPACE}: credential invalidations`
    );
    card.apply(ctx);
}

/** The key controller `apply` built for `ctx` (test surface; the loader ignores it). */
export function keyControllerOf(ctx: object): KeyController | undefined {
    return KEY_CONTROLLERS.get(ctx);
}

/** The body's doors, driven directly by test/client.test.mjs. */
export { editField, planSave, projectBody, saveCard, discardCard } from "./card/body.js";
