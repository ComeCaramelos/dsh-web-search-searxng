/**
 * Browser half — the card widget.
 *
 * Registers itself into the shared `settings.plugin.item` slot under the
 * `web-search-searxng` namespace the host half serves — the same shape the
 * harness's own "Web search" card uses: a collapsed row whose header is its
 * disclosure button, and, once open, one credential field plus three value
 * fields and a footer that saves or discards everything at once.
 *
 * The widget owns one piece of state and nothing else: whether it is expanded.
 * Every value it renders comes from the store the controller hands the slot, so
 * no staging, no parsing and no write logic lives here — read
 * {@link ../controller/index.ts the controller} for that, and
 * {@link ./fields.ts the field controls} for how one field is drawn.
 *
 * Nothing renders until the namespace is served: the card is a view over a
 * section, and a section that is still loading has nothing to show yet.
 */
import * as react from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { IconChevronDownOutline14 } from "@deepseek-ai/dsh-client-ui-primitives";
import STYLES from "../styles/SearxngCard.module.css";
import { SecretField, ValueField } from "./fields.js";

/**
 * Render the SearXNG settings card.
 * @param props - locale copy (`t`), the snapshot hook (`useWebSearchCard`) and the controller's handlers.
 * @returns the card, or nothing while the namespace is not served.
 */
export function SearxngCard(props: any): any {
    const [open, setOpen] = react.useState(false);
    const t = props.t;
    const state = props.useWebSearchCard((snapshot: any) => snapshot);
    if (!state.available) return null;

    // A save needs a clean plan: nothing invalid, nothing already in flight.
    const blocked = !state.dirty || state.invalid || state.saving;
    const disabled = !state.writable;

    return jsxs("li", {
        className: joinClasses(STYLES.card, open && STYLES.cardOpen),
        children: [
            jsxs("button", {
                type: "button",
                className: STYLES.header,
                "aria-expanded": open,
                "aria-label": `${t(open ? "collapse" : "expand")}: ${t("title")}`,
                onClick: () => setOpen(!open),
                children: [
                    jsxs("span", {
                        className: STYLES.headText,
                        children: [
                            jsxs("span", {
                                className: STYLES.nameRow,
                                children: [
                                    jsx("span", { className: STYLES.name, children: t("title") }),
                                    // A form carrying edits no save has written back
                                    // announces itself beside the title, the way the
                                    // sibling cards carry their status pill.
                                    state.dirty && jsx("span", { className: STYLES.badge, children: t("unsaved") })
                                ]
                            }),
                            jsx("span", { className: STYLES.desc, children: t("description") })
                        ]
                    }),
                    jsx(IconChevronDownOutline14, {
                        className: joinClasses(STYLES.chevron, open && STYLES.chevronOpen)
                    })
                ]
            }),
            open &&
                jsxs("div", {
                    className: STYLES.body,
                    children: [
                        !state.writable &&
                            jsx("p", { className: STYLES.readOnly, role: "status", children: t("readOnly") }),
                        jsx(SecretField, {
                            id: "plugin-config-web-search-searxng-key",
                            label: t("apiKey"),
                            hint: t("apiKeyHint"),
                            disabled: !state.apiKeyWritable,
                            text: state.apiKey.text,
                            configured: state.apiKeyConfigured,
                            stateLabel: state.apiKeyConfigured ? t("apiKeySet") : t("apiKeyUnset"),
                            onEdit: (text: string) => props.edit("apiKey", text)
                        }),
                        jsx(ValueField, {
                            id: "plugin-config-web-search-searxng-endpoint",
                            label: t("baseURL"),
                            hint: t("baseURLHint"),
                            overriddenLabel: t("overridden"),
                            resetLabel: t("reset"),
                            invalidLabel: t("invalidNumber"),
                            disabled,
                            ...state.baseURL,
                            onEdit: (text: string) => props.edit("baseURL", text),
                            onReset: () => props.resetField("baseURL")
                        }),
                        jsx(ValueField, {
                            id: "plugin-config-web-search-searxng-max-results",
                            label: t("maxResults"),
                            hint: t("maxResultsHint"),
                            overriddenLabel: t("overridden"),
                            resetLabel: t("reset"),
                            invalidLabel: t("invalidNumber"),
                            numeric: true,
                            disabled,
                            ...state.maxResults,
                            onEdit: (text: string) => props.edit("maxResults", text),
                            onReset: () => props.resetField("maxResults")
                        }),
                        jsx(ValueField, {
                            id: "plugin-config-web-search-searxng-language",
                            label: t("language"),
                            hint: t("languageHint"),
                            overriddenLabel: t("overridden"),
                            resetLabel: t("reset"),
                            invalidLabel: t("invalidNumber"),
                            disabled,
                            ...state.language,
                            onEdit: (text: string) => props.edit("language", text),
                            onReset: () => props.resetField("language")
                        }),
                        jsxs("div", {
                            className: STYLES.footer,
                            children: [
                                state.failed &&
                                    jsx("p", {
                                        className: joinClasses(STYLES.error, STYLES.failed),
                                        role: "status",
                                        children: t("saveFailed")
                                    }),
                                jsx("button", {
                                    type: "button",
                                    className: STYLES.footerButton,
                                    disabled: !state.dirty || state.saving,
                                    onClick: props.onDiscard,
                                    children: t("discard")
                                }),
                                jsx("button", {
                                    type: "button",
                                    className: joinClasses(STYLES.footerButton, STYLES.footerButtonPrimary),
                                    disabled: blocked,
                                    onClick: props.onSave,
                                    children: t(state.saving ? "saving" : "save")
                                })
                            ]
                        })
                    ]
                })
        ]
    });
}

/** Join the present class names. A `false` part (a card that is not open) drops out. */
function joinClasses(...parts: (string | false | undefined)[]): string {
    return parts.filter((part): part is string => Boolean(part)).join(" ");
}
