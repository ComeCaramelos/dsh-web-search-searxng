/**
 * Browser half of the SearXNG search provider — the configuration page of this
 * bundle's `web-search-searxng` row on the Web UI's Plugins page (dsh 0.2).
 *
 * The artifact is `lib/client.js`: a classic script in the DSH client module
 * system's lazy-CJS factory format (it registers
 * `window.__ModuleLoader__.load({ id, factory })`). It is emitted from the
 * `src/client/**` modules by `npm run build:client`, and served by the Host at
 * `/plugins/@comecaramelos/dsh-web-search-searxng/client.js` because
 * `package.json` declares `dsh.client`.
 *
 * The page is built from `@comecaramelos/dsh-ancesters`' `mountSettingsCard`
 * (bundled into the same file): it registers once, into the Plugins page's
 * `plugins.bundle.config` slot under `@comecaramelos/dsh-web-search-searxng`
 * (the bundle's own page, the one the Plugins list opens), and edits the
 * `web-search-searxng` row's configuration form (`configForms.get("web-search-searxng")`) — staged
 * `baseURL` / `maxResults` / `language` drafts written on Save. The API key never
 * rides the form: it is written through `remote.credentials`, addressed by the
 * form's `apiKeyEnv`.
 *
 * Source layout behind the emitted bundle: `src/client/index.ts` is the surface
 * and the descriptor, `card/body.ts` the one block, `controller/` the field
 * parsing and the key controller, `styles/` the stylesheet and `locales/` the
 * dictionaries.
 *
 * @module @comecaramelos/dsh-web-search-searxng/client
 */

/** Required services (cordis fiber inject): the card's own set plus `remote.credentials`. */
export declare const inject: readonly string[];

/**
 * Mount the configuration card on the bundle's page.
 * @param ctx - the browser plugin context.
 */
export declare function apply(ctx: unknown): void;

/** What the API key control renders. Never holds a stored secret. */
export interface SearxngKeyState {
    /** The credential reference the control addresses. */
    ref: string;
    /** Whether the Host reports a key configured for it. */
    configured: boolean;
    /** Whether the credentials domain would accept a write for it. */
    writable: boolean;
    /** The staged key text; blank until typed. */
    draft: string;
    /** Whether a key write is crossing the wire. */
    saving: boolean;
    /** Whether the last key write did not land. */
    failed: boolean;
}

/** The key controller behind the API key control (test surface). */
export interface SearxngKeyController {
    getSnapshot(): SearxngKeyState;
    edit(text: string): void;
    discard(): void;
    dirty(): boolean;
    save(): Promise<boolean>;
    refresh(): Promise<void>;
    announce(ref: string): void;
}

/** One field as its control renders it. */
export interface SearxngFieldView {
    /** Text the control shows: the draft, else the served value, else blank. */
    text: string;
    /** Whether the user layer carries this field (draws Overridden + reset). */
    overridden: boolean;
    /** Whether the draft is not a value this field accepts (blocks the save). */
    invalid: boolean;
}

/** Everything the page body renders. */
export interface SearxngBodyView {
    writable: boolean;
    dirty: boolean;
    invalid: boolean;
    saving: boolean;
    failed: boolean;
    fields: Record<"baseURL" | "maxResults" | "language", SearxngFieldView>;
    key: SearxngKeyState;
}

/** One planned step of a save. */
export type SearxngSaveStep =
    | { field: string; kind: "set"; value: string | number }
    | { field: string; kind: "reset" }
    | { field: string; kind: "drop" };

/** The key controller `apply` built for `ctx` (test surface; the loader ignores it). */
export declare function keyControllerOf(ctx: object): SearxngKeyController | undefined;
/** Stage typed text for one field (a draft equal to what is served is dropped). */
export declare function editField(controller: unknown, field: string, text: string): void;
/** What a save would do, or `undefined` while a draft does not parse. */
export declare function planSave(controller: unknown): SearxngSaveStep[] | undefined;
/** The page body's view off the card snapshot and the key state. */
export declare function projectBody(snapshot: unknown, key: SearxngKeyState): SearxngBodyView;
/** Write every staged edit; reports whether all of it landed. */
export declare function saveCard(controller: unknown, keys: SearxngKeyController): Promise<boolean>;
/** Drop every draft without writing anything. */
export declare function discardCard(controller: unknown, keys: SearxngKeyController): void;
