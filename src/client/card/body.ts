/**
 * Browser half — the configuration card's body, as its one block.
 *
 * The card machinery (`mountSettingsCard`, see ../index.ts) owns the slot, the
 * shared controller over this row's configuration form and the bundle page's
 * `page` shape; what is declared here is what that shape renders. Since dsh 0.2
 * the Plugins page owns the container and its identity line — the crumb, the
 * title, the description — so this body draws only the configuration itself:
 * one credential field, three value fields and a footer that saves or discards
 * everything at once.
 *
 * Two stores feed it, both subscribed by the body component:
 *
 *   - the shared controller's store (drafts overlaid on the served form, the
 *     `overridden` list the badges read, `saving` / `failed`);
 *   - the key store (../controller/credentials.ts), because the key never rides
 *     the form.
 *
 * {@link saveCard} is the Save door: the key through the credentials domain,
 * each blank draft as a reset to the row's own answer, every other draft parsed
 * (a count becomes a number) and applied in one staged write. A draft that does
 * not parse blocks the whole save rather than writing the half that did.
 */
import * as react from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import STYLES from "../styles/SearxngCard.module.css";
import { FIELD_SPECS } from "../controller/fields.js";
import type { KeyController, KeyState } from "../controller/credentials.js";
import { STAGED_FIELDS } from "../plugin-meta.js";
import { SecretField, ValueField } from "./fields.js";

/** The card snapshot fields the body reads (see dsh-ancesters `CardSnapshot`). */
export interface SnapshotView {
    available: boolean;
    writable: boolean;
    values: Record<string, unknown>;
    overridden?: readonly string[];
    dirty: boolean;
    saving: boolean;
    failed: boolean;
}

/** The controller doors the body composes (see dsh-ancesters `CardController`). */
export interface ControllerView {
    readonly store: { subscribe(fn: () => void): () => void; getSnapshot(): SnapshotView };
    getSnapshot(): SnapshotView;
    value(field: string): unknown;
    servedValue(field: string): unknown;
    stage(field: string, value: unknown): void;
    discard(): void;
    applyStaged(): Promise<boolean>;
    resetField(field: string): Promise<boolean>;
}

/** One field as its control renders it. */
export interface BodyField {
    /** Text the control shows: the draft, else the served value, else blank. */
    text: string;
    /** Whether the user layer carries this field (draws the badge + reset). */
    overridden: boolean;
    /** Whether the draft is not a value this field accepts (blocks the save). */
    invalid: boolean;
}

/** Everything the body renders for one pair of snapshots. */
export interface BodyView {
    writable: boolean;
    dirty: boolean;
    invalid: boolean;
    saving: boolean;
    failed: boolean;
    fields: Record<string, BodyField>;
    key: KeyState;
}

/** One planned step of a save. */
export type SaveStep =
    | { field: string; kind: "set"; value: string | number }
    | { field: string; kind: "reset" }
    | { field: string; kind: "drop" };

/** Whether a field stands in the user layer. */
function isOverridden(snapshot: SnapshotView, field: string): boolean {
    return Array.isArray(snapshot.overridden) && snapshot.overridden.indexOf(field) >= 0;
}

/** Project one field off the snapshot: a staged draft is text, a served answer is formatted. */
export function projectField(field: string, snapshot: SnapshotView): BodyField {
    const spec = FIELD_SPECS[field];
    const text = spec.format(snapshot.values[field]);
    return { text, overridden: isOverridden(snapshot, field), invalid: spec.parse(text) === undefined };
}

/** The whole view off the two snapshots. */
export function projectBody(snapshot: SnapshotView, key: KeyState): BodyView {
    const fields: Record<string, BodyField> = {};
    for (const field of STAGED_FIELDS) fields[field] = projectField(field, snapshot);
    return {
        writable: snapshot.writable === true,
        dirty: snapshot.dirty === true || key.draft.trim() !== "",
        invalid: STAGED_FIELDS.some((field) => fields[field].invalid),
        saving: snapshot.saving === true || key.saving,
        failed: snapshot.failed === true || key.failed,
        fields,
        key
    };
}

/**
 * Stage what the user typed. Text that reads back as exactly what is served
 * (or a blank over a field nothing answers) drops the draft instead, so the
 * "unsaved" state always means "a save would change something".
 */
export function editField(controller: ControllerView, field: string, text: string): void {
    const served = controller.servedValue(field);
    const spec = FIELD_SPECS[field];
    const unchanged = served === undefined ? text === "" : spec.format(served) === text;
    controller.stage(field, unchanged ? served : text);
}

/**
 * What a save would do with each staged field, in render order.
 * @returns the steps, or `undefined` when a draft does not parse (the save is blocked).
 */
export function planSave(controller: ControllerView): SaveStep[] | undefined {
    const snapshot = controller.getSnapshot();
    const steps: SaveStep[] = [];
    for (const field of STAGED_FIELDS) {
        const value = controller.value(field);
        const served = controller.servedValue(field);
        if (value === served) continue;
        const spec = FIELD_SPECS[field];
        const write = spec.parse(spec.format(value));
        if (write === undefined) return undefined;
        if (write.kind === "clear") {
            // Nothing stored, so nothing to clear: the draft is inert.
            steps.push(isOverridden(snapshot, field) ? { field, kind: "reset" } : { field, kind: "drop" });
            continue;
        }
        steps.push(write.value === served ? { field, kind: "drop" } : { field, kind: "set", value: write.value });
    }
    return steps;
}

/**
 * Write every staged edit and report whether all of it landed. A write that
 * did not land keeps its draft (the controller's `failed`, or the key store's),
 * so the user corrects rather than retyping.
 */
export async function saveCard(controller: ControllerView, keys: KeyController): Promise<boolean> {
    const steps = planSave(controller);
    if (steps === undefined) return false;
    let landed = await keys.save();
    for (const step of steps) {
        if (step.kind === "reset") landed = (await controller.resetField(step.field)) && landed;
    }
    for (const step of steps) {
        // Staging the parsed value replaces the text draft; staging the served
        // value drops it (the controller never keeps a draft equal to what is served).
        if (step.kind === "set") controller.stage(step.field, step.value);
        else if (step.kind === "drop") controller.stage(step.field, controller.servedValue(step.field));
    }
    landed = (await controller.applyStaged()) && landed;
    return landed;
}

/** Drop every draft — the fields' and the key's — without writing anything. */
export function discardCard(controller: ControllerView, keys: KeyController): void {
    controller.discard();
    keys.discard();
}

/** Subscribe a component to one store (stable subscribe door per store). */
function useStore<T>(store: { subscribe(fn: () => void): () => void; getSnapshot(): T }): T {
    const subscribe = react.useCallback((notify: () => void) => store.subscribe(notify), [store]);
    const read = react.useCallback(() => store.getSnapshot(), [store]);
    return react.useSyncExternalStore(subscribe, read, read);
}

/** What the block receives: the copy door and the two controllers. */
export interface SearxngBodyProps {
    t: (key: string) => string;
    controller: ControllerView;
    keys: KeyController;
}

/** The configuration body. A component of its own (the card machinery calls
 * blocks as plain functions), so its hooks keep a stable order across renders. */
function SearxngBody(props: SearxngBodyProps): any {
    const t = props.t;
    const controller = props.controller;
    const keys = props.keys;
    const view = projectBody(useStore(controller.store), useStore(keys.store));
    const idSeed = react.useId();
    // A save needs a clean plan: nothing invalid, nothing already in flight.
    const blocked = !view.dirty || view.invalid || view.saving;
    const disabled = !view.writable || view.saving;

    const valueField = (field: string, numeric: boolean) =>
        jsx(ValueField, {
            id: idSeed + "-" + field,
            label: t(field),
            hint: t(field + "Hint"),
            placeholder: t(field + "Placeholder"),
            overriddenLabel: t("overridden"),
            resetLabel: t("reset"),
            invalidLabel: t("invalidNumber"),
            numeric,
            disabled,
            ...view.fields[field],
            onEdit: (text: string) => editField(controller, field, text),
            onReset: () => {
                void controller.resetField(field);
            }
        });

    return jsxs("div", {
        className: STYLES.body,
        children: [
            view.writable ? null : jsx("p", { className: STYLES.readOnly, role: "status", children: t("readOnly") }),
            jsx(SecretField, {
                id: idSeed + "-key",
                label: t("apiKey"),
                hint: t("apiKeyHint"),
                disabled: !view.key.writable || view.saving,
                text: view.key.draft,
                configured: view.key.configured,
                stateLabel: view.key.configured ? t("apiKeySet") : t("apiKeyUnset"),
                onEdit: (text: string) => keys.edit(text)
            }),
            valueField("baseURL", false),
            valueField("maxResults", true),
            valueField("language", false),
            jsxs("div", {
                className: STYLES.footer,
                children: [
                    view.failed
                        ? jsx("p", { className: STYLES.error + " " + STYLES.failed, role: "status", children: t("saveFailed") })
                        : null,
                    jsx("button", {
                        type: "button",
                        className: STYLES.footerButton,
                        disabled: !(view.dirty || view.failed) || view.saving,
                        onClick: () => discardCard(controller, keys),
                        children: t("discard")
                    }),
                    jsx("button", {
                        type: "button",
                        className: STYLES.footerButton + " " + STYLES.footerButtonPrimary,
                        disabled: blocked,
                        onClick: () => {
                            void saveCard(controller, keys);
                        },
                        children: t(view.saving ? "saving" : "save")
                    })
                ]
            })
        ]
    });
}

/** The declared block: renders the body as its own component. */
export function SearxngBlock(props: SearxngBodyProps): any {
    return jsx(SearxngBody, props);
}
