/**
 * Browser half — how one field behaves as a control.
 *
 * A spec is the whole relationship between a settings field and its widget: the
 * field's name, how a stored value turns into the text the input shows, and how
 * the draft text turns back into a write. Keeping the parse here — rather than
 * inline in the controller or the widget — is what lets `save()` plan a whole
 * form from one source: the plan consults the very same parse the widget's
 * invalid badge reports.
 */

/** What one draft resolves to: a value to write, or a clear back to the layer below. */
export type FieldWrite = { kind: "set"; value: string | number } | { kind: "clear" };

/** A field's control behavior. */
export interface FieldSpec {
    /** The settings field this spec drives. */
    field: string;
    /** Stored value → the text the input shows. */
    format(value: unknown): string;
    /** Draft text → what a save would do, or `undefined` when the draft is not acceptable. */
    parse(text: string): FieldWrite | undefined;
}

/** A string field: blank means "clear", anything else is taken as given. */
export function textField(field: string): FieldSpec {
    return {
        field,
        format: (value) => (typeof value === "string" ? value : ""),
        parse: (text) => {
            const trimmed = text.trim();
            return trimmed === "" ? { kind: "clear" } : { kind: "set", value: trimmed };
        }
    };
}

/**
 * A numeric field: blank means "clear", non-numeric is reported invalid rather
 * than written. The widget reads the same `undefined` as its invalid badge, so
 * the control can never offer an invalid draft as saveable.
 */
export function numberField(field: string): FieldSpec {
    return {
        field,
        format: (value) => (typeof value === "number" ? String(value) : ""),
        parse: (text) => {
            const trimmed = text.trim();
            if (trimmed === "") return { kind: "clear" };
            const parsed = Number(trimmed);
            return Number.isFinite(parsed) ? { kind: "set", value: parsed } : undefined;
        }
    };
}

/** The field names the card edits, in the order the widget renders them. */
export const FIELD_NAMES = ["baseURL", "maxResults", "language"] as const;
