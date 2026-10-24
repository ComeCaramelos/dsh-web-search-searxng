/**
 * Browser half — the plugin's identity.
 *
 * The identifiers are contracts with the host half: the profile entry id keys
 * this row's configuration form, the package id keys the bundle page the card
 * stands on (`plugins.bundle.config`), and the
 * locale namespace is the lookup root for every string this half renders. The
 * browser half is emitted as its own bundle and cannot import
 * ../host/constants.ts, so they are mirrored here — keep both sides in step.
 */

/** The id this half registers with the loader's module table — and the package
 * half of the row key (this plugin is its own bundle). */
export const PLUGIN_ID = "@comecaramelos/dsh-web-search-searxng";

/** Profile entry id of the bundle row; the host half keys its form by it. */
export const ENTRY_ID = "web-search-searxng";

/** The locale namespace every string the page renders resolves through. */
export const LOCALE_NAMESPACE = "web-search-searxng";

/** The reference the key control addresses when the form states none. */
export const DEFAULT_KEY_REF = "SEARXNG_API_KEY";

/** The fields the page stages, in the order it renders them. */
export const STAGED_FIELDS = ["baseURL", "maxResults", "language"] as const;
