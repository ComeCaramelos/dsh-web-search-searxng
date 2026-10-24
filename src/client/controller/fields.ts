/**
 * Browser half — how one field behaves as a control.
 *
 * A spec is the whole relationship between a configuration field and its
 * widget: how a value (served, or a staged draft) turns into the text the input
 * shows, and how the draft text turns back into a write. Keeping the parse here
 * — rather than inline in the body or the widget — is what lets a save plan the
 * whole form from one source: the plan consults the very same parse the
 * widget's invalid badge reports.
 */

/** What one draft resolves to: a value to write, or a clear back to the layer below. */
export type FieldWrite = { kind: "set"; value: string | number } | { kind: "clear" };

/** A field's control behavior. */
export interface FieldSpec {
    /** The configuration field this spec drives. */
    field: string;
    /** Value → the text the input shows (a draft is already text). */
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
 * A positive-integer field: blank means "clear", anything else that is not a
 * whole number of at least 1 is reported invalid rather than written — the
 * schema (`step(1).min(1)`) would refuse it Host-side anyway. The widget reads
 * the same `undefined` as its invalid badge, so the control can never offer an
 * invalid draft as saveable.
 */
export function countField(field: string): FieldSpec {
    return {
        field,
        format: (value) => (typeof value === "number" ? String(value) : typeof value === "string" ? value : ""),
        parse: (text) => {
            const trimmed = text.trim();
            if (trimmed === "") return { kind: "clear" };
            const parsed = Number(trimmed);
            return Number.isInteger(parsed) && parsed >= 1 ? { kind: "set", value: parsed } : undefined;
        }
    };
}

/** One spec per staged field, keyed by field name. */
export const FIELD_SPECS: Readonly<Record<string, FieldSpec>> = {
    baseURL: textField("baseURL"),
    maxResults: countField("maxResults"),
    language: textField("language")
};
