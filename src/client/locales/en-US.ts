/**
 * Browser half — the English dictionary.
 *
 * Every string the card renders is resolved through the plugin's locale
 * namespace rather than hardcoded in the markup, so the same component answers
 * whichever tag the shell is displaying. Keys are the card's own short names; a
 * missing key falls back to `en` (see {@link ./index.ts the registry}).
 *
 * The copy deliberately names SearXNG rather than a deployment: the card edits
 * one provider, and the user should be able to tell which.
 */
export const en: Record<string, string> = {
    title: "SearXNG",
    description: "The SearXNG meta-search provider.",
    apiKey: "API key",
    apiKeyHint: "Stored outside the settings file. Leave blank to keep the current key. A key is optional for keyless instances.",
    apiKeySet: "A key is configured.",
    apiKeyUnset: "No key is configured.",
    baseURL: "Endpoint",
    baseURLHint: "SearXNG base URL. Leave blank to use the provider default.",
    maxResults: "Max results",
    maxResultsHint: "Upper bound on sources returned by one search. Leave blank for the default.",
    language: "Language",
    languageHint: "Search language, or 'all' for no preference.",
    overridden: "Overridden",
    reset: "Reset to default",
    readOnly: "This deployment stores settings read-only.",
    expand: "Show settings",
    collapse: "Hide settings",
    save: "Save",
    saving: "Saving…",
    discard: "Discard",
    unsaved: "Unsaved",
    saveFailed: "The deployment did not accept these values; they were left for you to correct.",
    invalidNumber: "Enter a number, or leave blank to use the default."
};
