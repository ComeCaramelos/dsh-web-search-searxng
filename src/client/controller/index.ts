/**
 * Browser half — the card's controller: what the card shows, and what a save does.
 *
 * It is the only piece that joins four facts into one projection the widget
 * renders: the staged form, the section the Host serves, the credential the key
 * control addresses, and the save currently crossing the wire.
 *
 * The credential is the one thing on the card that is not a settings field, and
 * it earns a rule of its own. The key is staged as text only — the form never
 * holds a secret value — and every "configured or not" answer comes from the
 * remote's credentials domain, addressed by whatever reference the section
 * currently resolves for `apiKeyEnv`. That reference can move underneath the card
 * (settings file, composed layer), so it is read afresh on every pass, and an
 * announcement naming a reference the card no longer addresses is dropped rather
 * than chased.
 *
 * The pieces live beside this file:
 *
 *   ./form.ts     the staged form: drafts, plan, read-back
 *   ./fields.ts   one spec per field — the only parsing the card does
 *   ./state.ts    the projection's shape and its not-yet-served seed
 */
import { numberField, textField } from "./fields.js";
import { CardForm } from "./form.js";
import type { CardProjection } from "./state.js";

/** The field the key control edits; staged as text, written through the credentials domain. */
export const API_KEY_FIELD = "apiKey";

/** The reference the key control addresses when the section states none. */
export const DEFAULT_KEY_REF = "SEARXNG_API_KEY";

/** What the card hands the widget: the snapshot store plus the handlers it calls. */
export interface CardFace {
    hooks: { webSearchCard: any };
    edit: (field: string, text: string) => void;
    resetField: (field: string) => void;
    onSave: () => void;
    onDiscard: () => void;
}

/**
 * The live card behind the widget.
 */
export class SearxngCardController {
    /** The store the widget reads; every projection change pushes through it. */
    readonly store: any;

    private readonly remote: any;
    private readonly form: CardForm;
    /** The credential facts, re-read whenever the reference or the Host says so. */
    private credentials: { ref: string; configured: boolean; writable: boolean };
    private saving: boolean;
    private failed: boolean;

    /**
     * @param scope - the settings scope bound to this plugin's namespace.
     * @param remote - the remote face: `credentials.describe`/`set`, and `$on` for invalidations.
     */
    constructor(scope: any, remote: any) {
        this.remote = remote;
        this.form = new CardForm(
            scope,
            [textField("baseURL"), numberField("maxResults"), textField("language")],
            [{ field: API_KEY_FIELD, write: (text) => this.writeKey(text) }]
        );
        this.credentials = { ref: "", configured: false, writable: true };
        this.saving = false;
        this.failed = false;
        this.store = this.form.bind(() => this.projection());
        // The reference lives in the section, so every section change may move it.
        scope.subscribe(() => {
            void this.readCredentials();
        });
        void this.readCredentials();
    }

    /**
     * Everything the slot injects into the card cell.
     * @returns the store the widget subscribes to, plus the handlers its controls call.
     */
    inject(): CardFace {
        return {
            hooks: { webSearchCard: this.store },
            edit: (field, text) => {
                this.failed = false;
                this.form.edit(field, text);
            },
            resetField: (field) => {
                this.failed = false;
                this.form.resetField(field);
            },
            onSave: () => {
                void this.save();
            },
            onDiscard: () => {
                this.discard();
            }
        };
    }

    /** What the card renders right now. */
    projection(): CardProjection {
        const plan = this.form.available() ? this.form.plan() : [];
        return {
            available: this.form.available(),
            writable: this.form.writable(),
            dirty: plan.length > 0,
            invalid: plan.some((item) => item.run === undefined),
            saving: this.saving,
            failed: this.failed,
            baseURL: this.form.field("baseURL"),
            maxResults: this.form.field("maxResults"),
            language: this.form.field("language"),
            apiKey: this.form.field(API_KEY_FIELD),
            apiKeyConfigured: this.credentials.configured,
            apiKeyWritable: this.credentials.writable
        };
    }

    /**
     * Write every staged edit — the settings fields through the scope, the key
     * through the credentials domain — and re-seed the form from what landed.
     *
     * A write that did not land keeps its draft and raises the failure flag, so
     * the user corrects rather than retyping.
     */
    async save(): Promise<void> {
        const plan = this.form.available() ? this.form.plan() : [];
        const writes = plan.flatMap((item) => (item.run === undefined ? [] : [item.run]));
        if (plan.length === 0 || this.saving || writes.length !== plan.length) return;
        this.saving = true;
        this.failed = false;
        this.publishCard();
        let landed = true;
        for (const write of writes) landed = (await write()) && landed;
        if (landed) this.form.discard();
        this.saving = false;
        this.failed = !landed;
        this.publishCard();
    }

    /** Drop every draft and the failure flag, without writing anything. */
    discard(): void {
        const plan = this.form.available() ? this.form.plan() : [];
        if (plan.length === 0 && !this.failed) return;
        this.form.discard();
        this.failed = false;
        this.publishCard();
    }

    /**
     * Re-read the credential the card addresses, after the Host announced one.
     * An announcement naming a different reference is ignored: the card must not
     * chase a key it no longer edits.
     */
    refreshCredential(ref: string): void {
        if (ref === this.credentials.ref) void this.readCredentials();
    }

    /** The reference the key control addresses, read from the section each time. */
    private keyRef(): string {
        const snapshot = this.form.snapshotOf();
        if (snapshot.status !== "ready") return DEFAULT_KEY_REF;
        const declared = snapshot.value?.apiKeyEnv;
        return typeof declared === "string" && declared.length > 0 ? declared : DEFAULT_KEY_REF;
    }

    /** Read what the credentials domain reports about the addressed reference. */
    private async readCredentials(): Promise<void> {
        const ref = this.keyRef();
        if (ref !== this.credentials.ref) {
            this.credentials = { ref, configured: false, writable: true };
            this.publishCard();
        }
        let response: any;
        try {
            response = await this.remote.credentials.describe([ref]);
        } catch {
            // A domain that cannot be reached reports no facts; the control stays
            // "not configured" rather than blocking the card.
            return;
        }
        if (!response?.ok) return;
        if (this.keyRef() !== this.credentials.ref) return;
        const view = response.value?.[ref];
        const configured = view?.configured ?? false;
        const writable = view?.writable ?? true;
        if (configured === this.credentials.configured && writable === this.credentials.writable) return;
        this.credentials = { ...this.credentials, configured, writable };
        this.publishCard();
    }

    /** Write the staged key through the credentials domain; reports whether it landed. */
    private async writeKey(value: string): Promise<boolean> {
        const ref = this.keyRef();
        try {
            await this.remote.credentials.set(ref, value);
        } catch {
            /* a domain that refuses the write simply reports nothing configured below */
        }
        await this.readCredentials();
        return this.credentials.configured;
    }

    /** Push the projection through the store the widget reads. */
    private publishCard(): void {
        this.store.set(this.projection());
    }
}

// The exported surface is what each declaration above already names: the
// constants, the face, and the projection type the widget reads.
