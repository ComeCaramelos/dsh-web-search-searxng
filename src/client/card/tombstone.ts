/**
 * Browser half — the shadow that retires the shipped card.
 *
 * The plugin-configuration tab builds its cell list from the registrations that
 * claim a key, and it does not dedupe, so a second entry claiming
 * `web-search-deepseek` would leave two cards in the list. A keyed slot renders
 * the entry with the lowest priority, and the harness's own card registers at
 * priority 0 — so this component, registered at -1 under that key, wins the cell
 * and renders nothing.
 *
 * The DeepSeek section keeps its seat, and the provider behind it is untouched
 * (still selectable through `web.config.searchProvider`); only the duplicate card
 * disappears. Without this file the shipped DeepSeek card reappears beside ours.
 */

/** Render nothing. The cell exists; it just draws no markup. */
export function SearxngTombstone(): null {
    return null;
}
