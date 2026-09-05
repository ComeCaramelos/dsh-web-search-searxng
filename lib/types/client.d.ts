/**
 * Browser half of the SearXNG search provider — the Web-search settings card
 * the Web UI renders under Settings → Plugins → Plugin configuration.
 *
 * The artifact is `lib/client.js`: a classic script in the DSH client
 * module system's lazy-CJS factory format (it registers
 * `window.__ModuleLoader__.load({ id, factory })`). It ships as-is — the
 * repository has no build step — and is served by the Host at
 * `/plugins/@deepseek-ai/dsh-web-search-searxng/client.js` once the package
 * declares `dsh.client` (see `package.json`).
 *
 * The card keeps the look of the "Web search" card the harness ships for the
 * `web-search-deepseek` namespace, with its texts updated to name the SearXNG
 * provider it edits. It registers into the shared `settings.plugin.item` slot
 * twice:
 * - under the `web-search-deepseek` key at priority -1, a null-rendering
 *   tombstone shadowing the shipped card (keyed slots render the lowest
 *   priority), so the DeepSeek section keeps its seat but shows no card;
 * - under the `web-search-searxng` key, the card itself, rendered whenever
 *   the section is available.
 * The tab dispatches a key only when the Host serves its namespace, so a
 * deployment missing this plugin shows no trace of the card either way.
 *
 * @module @deepseek-ai/dsh-web-search-searxng/client
 */
import type { Context } from '@deepseek-ai/cordis';
/** Required services (cordis fiber inject). */
export declare const inject: string[];
/** One field as a card control renders it. */
export interface SearxngCardFieldState {
    /** Draft text the control renders. */
    text: string;
    /** Whether saving would leave a user-layer entry for this field. */
    overridden: boolean;
    /** Whether the draft is not a value this field accepts (blocks saving). */
    invalid: boolean;
}
/** What the SearXNG web-search card renders. */
export interface SearxngCardState {
    /** False while the namespace is not served; the card renders nothing. */
    available: boolean;
    /** Whether the Host document accepts writes. */
    writable: boolean;
    /** Whether the form holds edits a save would write. */
    dirty: boolean;
    /** Whether any staged draft is invalid (blocks the save). */
    invalid: boolean;
    /** Whether a save is crossing the wire. */
    saving: boolean;
    /** Whether the last save did not land as staged. */
    failed: boolean;
    baseURL: SearxngCardFieldState;
    maxResults: SearxngCardFieldState;
    language: SearxngCardFieldState;
    /** The staged credential, blank until typed. */
    apiKey: SearxngCardFieldState;
    /** Whether the Host reports a credential configured for the referenced key. */
    apiKeyConfigured: boolean;
    /** Whether the credentials domain accepts a write for it. */
    apiKeyWritable: boolean;
}
/** The registration-side face both slot entries inject (one shared store). */
export interface SearxngCardFace {
    /** The card's snapshot store, injected as the `webSearchCard` hook. */
    hooks: {
        webSearchCard: unknown;
    };
    /** Staged draft text for one field. */
    edit: (field: string, text: string) => void;
    /** Stage a clear, so saving lets the field re-inherit the composition layer. */
    resetField: (field: string) => void;
    /** Write every staged edit, then re-seed from what the Host accepted. */
    onSave: () => void;
    /** Drop every staged edit. */
    onDiscard: () => void;
}
/**
 * Mount the SearXNG web-search card into the plugin configuration tab.
 * @param ctx - the browser plugin context.
 */
export declare function apply(ctx: Context): void;
