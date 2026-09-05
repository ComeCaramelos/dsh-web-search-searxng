/**
 * Browser half — the staged form: drafts in, plan out.
 *
 * Nothing here renders, talks to the Host, or knows what a credential is. It
 * owns exactly what the card's staging model rests on: a draft map, a `plan()`
 * that turns drafts into the writes a save would perform, and the read-back that
 * says whether a write actually landed.
 *
 * Four rules explain its shape:
 *
 *   - A field with no draft reports the section's effective value, not the last
 *     value the user typed. After a Host-side change the widget re-seeds on its
 *     own, which is what a discard drops back onto.
 *   - A plan entry with no `run` is a draft that cannot be written — an invalid
 *     draft. A save refuses the whole batch rather than writing the half that
 *     parsed.
 *   - The plan is computed against the effective value, so a draft equal to what
 *     the section already serves writes nothing: the "unsaved" badge always means
 *     "this would change something".
 *   - A secret field is staged as text only. It is never compared against a
 *     stored value (there is nothing to read back), and a blank draft plans no
 *     write at all — leaving the key field blank means "keep what is there".
 */
import { createSnapshotStore } from "@deepseek-ai/dsh-client-store";
import type { FieldSpec, FieldWrite } from "./fields.js";

/** The staged edit for one field. */
interface StagedEdit {
    /** Draft text, exactly as typed. */
    text: string;
    /** True when the widget asked the field to re-inherit the layer below. */
    clear: boolean;
}

/** A credential field: its write goes somewhere other than the settings scope. */
export interface SecretSpec {
    /** The field the control edits. */
    field: string;
    /** Write the staged secret; reports whether it landed. */
    write(text: string): Promise<boolean>;
}

/** What one save entry would do. A missing `run` marks an unwritable draft. */
export interface PlannedWrite {
    field: string;
    /** Perform the write. Absent means the draft is invalid and blocks the save. */
    run?: () => Promise<boolean>;
}

/** What the widget renders for one field. */
export interface FieldState {
    /** Draft text the control shows. */
    text: string;
    /** Whether a save would leave a user-layer entry for this field. */
    overridden: boolean;
    /** Whether the draft is not a value this field accepts. */
    invalid: boolean;
}

/** A staged form over one settings namespace. */
export class CardForm {
    private readonly scope: any;
    private readonly specs: Map<string, FieldSpec>;
    private readonly secretSpecs: Map<string, SecretSpec>;
    private readonly staged: Map<string, StagedEdit>;
    private readonly listeners: Set<() => void>;

    /**
     * @param scope - the bound namespace scope: its snapshots, and the writes a save performs.
     * @param specs - one spec per field that lives in the settings layer.
     * @param secrets - the fields whose values go somewhere other than the scope.
     */
    constructor(scope: any, specs: FieldSpec[], secrets: SecretSpec[] = []) {
        this.scope = scope;
        this.specs = new Map(specs.map((spec) => [spec.field, spec]));
        this.secretSpecs = new Map(secrets.map((spec) => [spec.field, spec]));
        this.staged = new Map();
        this.listeners = new Set();
        // A Host-side change re-seeds every undrafted field: publish so whoever
        // bound the projection recomputes.
        scope.subscribe(() => this.publish());
    }

    /**
     * Mirror the projection into a subscribable store.
     * Each publish pushes what the projection currently answers, so a React
     * component can read it through the standard snapshot hook.
     */
    bind(project: () => unknown): any {
        const store = createSnapshotStore(project());
        this.listeners.add(() => store.set(project()));
        return store;
    }

    /** One field's rendered state: draft text, whether it overrides, whether it is invalid. */
    field(field: string): FieldState {
        const staged = this.staged.get(field);
        if (this.secretSpecs.has(field)) {
            // Nothing to read back: the control shows only what was typed.
            return { text: staged?.text ?? "", overridden: false, invalid: false };
        }
        const spec = this.spec(field);
        if (staged === undefined) {
            return { text: spec.format(this.sectionValue(field)), overridden: this.stored(field), invalid: false };
        }
        const write: FieldWrite | undefined = staged.clear ? { kind: "clear" } : spec.parse(staged.text);
        return { text: staged.text, overridden: write?.kind === "set", invalid: write === undefined };
    }

    /** Record what the user typed. */
    edit(field: string, text: string): void {
        this.stage(field, { text, clear: false });
    }

    /**
     * Stage a clear: the field re-inherits the layer below. The draft keeps its
     * text so the badge can preview the re-inheritance, and a save that lands
     * drops the user-layer entry.
     */
    resetField(field: string): void {
        this.stage(field, { text: this.spec(field).format(this.baseValue(field)), clear: true });
    }

    /** Drop every draft — what a discard does. */
    discard(): void {
        this.staged.clear();
    }

    /** Whether the section is served at all; nothing renders before it is. */
    available(): boolean {
        return this.scope.getSnapshot().status === "ready";
    }

    /** Whether this deployment accepts writes at all. */
    writable(): boolean {
        return this.scope.getSnapshot().writable === true;
    }

    /**
     * The writes a save would perform, in staging order.
     * @returns the plan; an entry without `run` marks an invalid draft.
     */
    plan(): PlannedWrite[] {
        const plan: PlannedWrite[] = [];
        for (const [field, staged] of this.staged) {
            const secret = this.secretSpecs.get(field);
            if (secret !== undefined) {
                // A blank key draft means "keep the stored key", so it plans nothing.
                const value = staged.text.trim();
                if (value !== "") plan.push({ field, run: () => secret.write(value) });
                continue;
            }
            const spec = this.spec(field);
            if (staged.clear) {
                // Nothing stored, so nothing to clear: the draft is inert.
                if (this.stored(field)) plan.push({ field, run: () => this.clear(field) });
                continue;
            }
            const write = spec.parse(staged.text);
            if (write === undefined) {
                plan.push({ field });
                continue;
            }
            if (write.kind === "clear") {
                plan.push({ field, run: () => this.clear(field) });
                continue;
            }
            // A draft that already equals what the section serves writes nothing.
            if (write.value === this.sectionValue(field)) continue;
            plan.push({ field, run: () => this.store(field, write.value) });
        }
        return plan;
    }

    /** Write one value through the scope, reporting whether it landed. */
    async store(field: string, value: string | number): Promise<boolean> {
        await this.scope.set(field, value);
        return this.userLayer()?.[field] === value;
    }

    /** Drop one user-layer entry, reporting whether it landed. */
    async clear(field: string): Promise<boolean> {
        await this.scope.unset(field);
        return !this.stored(field);
    }

    /** The live snapshot, for whoever derives facts from it. */
    snapshotOf(): any {
        return this.scope.getSnapshot();
    }

    /** Notify everything bound to the projection. */
    publish(): void {
        for (const notify of this.listeners) notify();
    }

    /** Stage an edit and publish — one place, so a later validation hook lands once. */
    private stage(field: string, edit: StagedEdit): void {
        this.staged.set(field, edit);
        this.publish();
    }

    private spec(field: string): FieldSpec {
        const spec = this.specs.get(field);
        if (spec === undefined) throw new Error(`plugin card has no field ${field}`);
        return spec;
    }

    private sectionValue(field: string): unknown {
        return this.snapshotOf().value?.[field];
    }

    private baseValue(field: string): unknown {
        return this.snapshotOf().base?.[field];
    }

    private userLayer(): Record<string, unknown> | undefined {
        return this.snapshotOf().user;
    }

    /** Whether the user layer currently holds this field. */
    private stored(field: string): boolean {
        const user = this.userLayer();
        return user !== undefined && Object.hasOwn(user, field);
    }
}
