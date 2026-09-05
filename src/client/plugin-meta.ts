/**
 * Browser half — the plugin's identity and the services it asks the shell for.
 *
 * `name` is what the loader's `window.__ModuleLoader__.load` registration carries
 * (the same id the Host serves the bundle under); `inject` is the list of
 * services the browser context hands `apply`. Nothing here computes anything, so
 * a reader can check the browser contract in one screen.
 */

/** The id this half registers with the loader's module table. */
export const PLUGIN_ID = "@comecaramelos/dsh-web-search-searxng";

/** The namespace the card edits — and the key it registers its own cell under. */
export const SETTINGS_NAMESPACE = "web-search-searxng";

/**
 * The namespace the harness-shipped card registers under.
 *
 * The plugin-configuration tab builds its cell list from the registrations that
 * claim a key, without deduping, so a second registration claiming the same key
 * renders that cell twice. This half therefore claims that key with a
 * null-rendering tombstone (see `./card/tombstone.ts`) — the section keeps its
 * seat, the shipped card stops showing.
 */
export const DEEPSEEK_SETTINGS_NAMESPACE = "web-search-deepseek";

/** The locale namespace every string the card renders resolves through. */
export const LOCALE_NAMESPACE = "web-search-searxng";

/** Services the browser context injects, all answered by the running GUI. */
export const inject = ["slots", "locale", "remote", "remote.credentials", "settingsScope"];
