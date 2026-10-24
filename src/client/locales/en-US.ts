/**
 * Browser half — the English dictionary.
 *
 * Every string the page renders is resolved through the plugin's locale
 * namespace rather than hardcoded in the markup, so the same component answers
 * whichever tag the shell is displaying. Keys are the page's own short names; a
 * missing key falls back to `en` (see {@link ./index.ts the registry}). The
 * shared dsh-ancesters keys merge below these, so these always win.
 *
 * The copy deliberately names SearXNG rather than a deployment: the page edits
 * one provider, and the user should be able to tell which.
 */
export const en: Record<string, string> = {
    apiKey: "API key",
    apiKeyHint: "Stored by the credentials service, never in the profile. Leave blank to keep the current key. A key is optional for keyless instances.",
    apiKeySet: "Configured",
    apiKeyUnset: "Not configured",
    baseURL: "Endpoint",
    baseURLHint: "SearXNG base URL. Leave blank to use $SEARXNG_BASE_URL, or the default.",
    baseURLPlaceholder: "http://localhost:8080",
    maxResults: "Max results",
    maxResultsHint: "Upper bound on sources returned by one search. Leave blank to use $SEARXNG_MAX_RESULTS, or the default.",
    maxResultsPlaceholder: "10",
    language: "Language",
    languageHint: "Search language, or 'all' for no preference. Leave blank to use $SEARXNG_LANGUAGE, or 'all'.",
    languagePlaceholder: "all",
    overridden: "Overridden",
    reset: "Reset to default",
    readOnly: "This deployment stores its configuration read-only.",
    save: "Save",
    saving: "Saving…",
    discard: "Discard",
    saveFailed: "The deployment did not accept these values; they were left for you to correct.",
    invalidNumber: "Enter a whole number of at least 1, or leave blank to use the default."
};
