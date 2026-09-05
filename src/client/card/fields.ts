/**
 * Browser half — the two field controls the card renders.
 *
 * Both follow the layout the sibling cards carry (`dsh-docker-desktop-mcp`,
 * `dsh-chrome-mcp`, `dsh-hover-information`): a two-row field — the title and
 * whatever sits beside it in the inline `.fieldRow`, the value control on its own
 * line, one copy line beneath — and differ only in what the state pill says and
 * whether the value can be read back. Splitting them out keeps
 * `../card/index.ts` about layout rather than markup, and the same copy line
 * renders either as a hint or as the reason a save is blocked (the reference's
 * one `.fieldDesc`, recolored rather than swapped).
 */
import { jsx, jsxs } from "react/jsx-runtime";
import STYLES from "../styles/SearxngCard.module.css";

/** A text or numeric field the section can serve back. */
export function ValueField(props: any): any {
    return jsxs("div", {
        className: STYLES.field,
        children: [
            jsxs("div", {
                className: STYLES.fieldRow,
                children: [
                    jsx("label", { className: STYLES.fieldTitle, htmlFor: props.id, children: props.label }),
                    props.overridden &&
                        jsxs("span", {
                            className: STYLES.badges,
                            children: [
                                jsx("span", { className: STYLES.badge, children: props.overriddenLabel }),
                                jsx("button", {
                                    type: "button",
                                    className: STYLES.reset,
                                    disabled: props.disabled,
                                    onClick: props.onReset,
                                    children: props.resetLabel
                                })
                            ]
                        })
                ]
            }),
            jsx("input", {
                id: props.id,
                className: props.invalid ? STYLES.input + " " + STYLES.inputInvalid : STYLES.input,
                type: "text",
                ...(props.numeric ? { inputMode: "numeric" } : {}),
                ...(props.invalid ? { "aria-invalid": true } : {}),
                value: props.text,
                placeholder: props.placeholder ?? "",
                disabled: props.disabled,
                onChange: (event: any) => props.onEdit(event.target.value)
            }),
            // A div, not a p: the reference's `.fieldDesc` carries no margin
            // reset because it is never a paragraph, and UA margins would
            // break the two-row field's rhythm.
            jsx("div", {
                className: props.invalid ? STYLES.fieldDesc + " " + STYLES.fieldDescInvalid : STYLES.fieldDesc,
                children: props.invalid ? props.invalidLabel : props.hint
            })
        ]
    });
}

/**
 * The credential field.
 *
 * Write-only by design: the control never learns what is stored, only that
 * something is. A blank draft therefore means "keep what is there" — the copy on
 * the desc line is what tells the user that.
 */
export function SecretField(props: any): any {
    return jsxs("div", {
        className: STYLES.field,
        children: [
            jsxs("div", {
                className: STYLES.fieldRow,
                children: [
                    jsx("label", { className: STYLES.fieldTitle, htmlFor: props.id, children: props.label }),
                    jsx("span", {
                        className: STYLES.badges,
                        children: jsx("span", {
                            className: props.configured ? STYLES.badge : STYLES.badgeMuted,
                            children: props.stateLabel
                        })
                    })
                ]
            }),
            jsx("input", {
                id: props.id,
                className: STYLES.input,
                type: "password",
                autoComplete: "off",
                value: props.text,
                disabled: props.disabled,
                onChange: (event: any) => props.onEdit(event.target.value)
            }),
            // A div — see the note on the value field's copy line.
            jsx("div", { className: STYLES.fieldDesc, children: props.hint })
        ]
    });
}
