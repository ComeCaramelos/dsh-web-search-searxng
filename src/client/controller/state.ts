/**
 * Browser half — the projection the widget renders.
 *
 * The card's whole contract with the widget lives in this file: what the widget
 * may render, and what a not-yet-served namespace looks like. A projection never
 * holds a secret value — the key field is staged text only — so this shape is
 * safe to read on every render without a disclosure question.
 */

/** One field as its control renders it. */
export interface CardFieldState {
    /** Draft text the control shows. */
    text: string;
    /** Whether a save would leave a user-layer entry for this field. */
    overridden: boolean;
    /** Whether the draft is not a value this field accepts; blocks the save. */
    invalid: boolean;
}

/** Everything the card renders for one snapshot. */
export interface CardProjection {
    /** False while the namespace is not served: the card renders nothing. */
    available: boolean;
    /** Whether this deployment's document accepts writes. */
    writable: boolean;
    /** Whether the form holds edits a save would write. */
    dirty: boolean;
    /** Whether any staged draft is unwritable; blocks the save. */
    invalid: boolean;
    /** Whether a save is crossing the wire. */
    saving: boolean;
    /** Whether the last save did not land as staged. */
    failed: boolean;
    /** The endpoint control. */
    baseURL: CardFieldState;
    /** The result-count control. */
    maxResults: CardFieldState;
    /** The language control. */
    language: CardFieldState;
    /** The staged key text; blank until typed. */
    apiKey: CardFieldState;
    /** Whether the Host reports a key configured for the addressed reference. */
    apiKeyConfigured: boolean;
    /** Whether the credentials domain would accept a write for it. */
    apiKeyWritable: boolean;
}
