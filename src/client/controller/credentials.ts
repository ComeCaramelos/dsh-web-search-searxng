/**
 * Browser half — the API key: the one control on the page that is not a field.
 *
 * The key never rides the configuration form: writing it there would land a
 * literal secret in the profile patch. It is staged here as text only — this
 * store never learns what is stored, only whether something is — and written
 * through the remote's credentials domain, addressed by whatever reference the
 * form currently answers for `apiKeyEnv`. That reference can move underneath
 * the page, so it is read afresh through `refOf` on every pass, and an
 * announcement naming a reference the page no longer addresses is dropped
 * rather than chased.
 *
 * The shared card controller (dsh-ancesters) owns everything else on the page;
 * this store sits beside it, subscribed by the body the same way.
 */
import { createSnapshotStore } from "@deepseek-ai/dsh-client-store";
import { DEFAULT_KEY_REF } from "../plugin-meta.js";

/** What the key control renders. */
export interface KeyState {
    /** The credential reference the control addresses. */
    ref: string;
    /** Whether the Host reports a key configured for it. */
    configured: boolean;
    /** Whether the credentials domain would accept a write for it. */
    writable: boolean;
    /** The staged key text; blank until typed. Never a stored value. */
    draft: string;
    /** Whether a key write is crossing the wire. */
    saving: boolean;
    /** Whether the last key write did not land (its draft stands). */
    failed: boolean;
}

/** The remote face this store calls. */
export interface CredentialsRemote {
    credentials?: {
        describe(refs: string[]): Promise<{ ok?: boolean; value?: Record<string, { configured?: boolean; writable?: boolean }> } | undefined>;
        set(ref: string, value: string): Promise<unknown>;
    };
}

/** The key control's live state over the credentials domain. */
export class KeyController {
    /** The store the body subscribes to. */
    readonly store: { subscribe(fn: () => void): () => void; getSnapshot(): KeyState; set(next: KeyState): void };

    private readonly remote: CredentialsRemote | undefined;
    private readonly refOf: () => unknown;

    /**
     * @param remote - the shell's remote API (`credentials.describe` / `set`).
     * @param refOf - reads the reference the form currently answers for `apiKeyEnv`.
     */
    constructor(remote: CredentialsRemote | undefined, refOf: () => unknown) {
        this.remote = remote;
        this.refOf = refOf;
        this.store = createSnapshotStore<KeyState>({ ref: this.keyRef(), configured: false, writable: true, draft: "", saving: false, failed: false });
    }

    /** The current state. */
    getSnapshot(): KeyState {
        return this.store.getSnapshot();
    }

    /** Record what the user typed. */
    edit(text: string): void {
        this.patch({ draft: String(text), failed: false });
    }

    /** Drop the staged key and the failure it left. */
    discard(): void {
        const current = this.getSnapshot();
        if (current.draft !== "" || current.failed) this.patch({ draft: "", failed: false });
    }

    /** Whether a save would write a key (a blank draft means "keep what is there"). */
    dirty(): boolean {
        return this.getSnapshot().draft.trim() !== "";
    }

    /**
     * Write the staged key through the credentials domain; reports whether it
     * landed (the domain then reports the reference configured). A key that
     * landed drops its draft; one that did not keeps it for the user to retry.
     */
    async save(): Promise<boolean> {
        const value = this.getSnapshot().draft.trim();
        if (value === "") return true;
        const ref = this.keyRef();
        this.patch({ saving: true });
        try {
            await this.remote?.credentials?.set(ref, value);
        } catch {
            /* a domain that refuses the write simply reports nothing configured below */
        }
        await this.refresh();
        const landed = this.getSnapshot().configured;
        this.patch(landed ? { saving: false, draft: "", failed: false } : { saving: false, failed: true });
        return landed;
    }

    /**
     * Re-read the credential the control addresses, after the Host announced
     * one. An announcement naming a different reference is ignored.
     */
    announce(ref: string): void {
        if (ref === this.getSnapshot().ref) void this.refresh();
    }

    /** Re-read what the credentials domain reports about the addressed reference
     * (also re-addressing it when the form's `apiKeyEnv` moved). */
    async refresh(): Promise<void> {
        const ref = this.keyRef();
        if (ref !== this.getSnapshot().ref) this.patch({ ref, configured: false, writable: true });
        const describe = this.remote?.credentials?.describe;
        if (typeof describe !== "function") return;
        let response: Awaited<ReturnType<typeof describe>>;
        try {
            response = await describe.call(this.remote!.credentials, [ref]);
        } catch {
            // A domain that cannot be reached reports no facts; the control stays
            // "not configured" rather than blocking the page.
            return;
        }
        if (response?.ok !== true || this.keyRef() !== ref) return;
        const view = response.value?.[ref];
        const configured = view?.configured === true;
        const writable = view?.writable ?? true;
        const current = this.getSnapshot();
        if (configured !== current.configured || writable !== current.writable) this.patch({ configured, writable });
    }

    /** The reference the form answers now, or the default when it states none. */
    private keyRef(): string {
        const declared = this.refOf();
        return typeof declared === "string" && declared.length > 0 ? declared : DEFAULT_KEY_REF;
    }

    private patch(next: Partial<KeyState>): void {
        this.store.set({ ...this.store.getSnapshot(), ...next });
    }
}
