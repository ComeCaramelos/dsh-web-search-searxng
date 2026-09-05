/**
 * Host half — structural views of the seams this plugin drives.
 *
 * The plugin reads three seams beyond `ctx.web`: the credential domain, the
 * launcher-owned environment snapshot, and the initiating Agent whose session
 * carries the recorded request.
 *
 * `Context` needs no widening for any of them: `dsh-credentials`,
 * `dsh-launch-environment`, `dsh-agent` and `dsh-web` each augment
 * `@deepseek-ai/cordis`'s `Context` from their own type surface, so the seams
 * appear on the context exactly where their packages are part of the
 * compilation — and stay absent (yielding `undefined` through `ctx.get`) in a
 * composition that does not mount them.
 *
 * The accessor interfaces below exist only to describe, in one place, the subset
 * of each seam this half actually calls: widening them to match upstream's full
 * surface is a drift risk no test catches.
 */
import type { Context } from "@deepseek-ai/cordis";

/** The plugin context this half is applied with. */
export type PluginContext = Context;

/** The initiating Agent, narrowed to the one capability this plugin uses. */
export interface AgentSessionOwner {
    /** The agent's session; the recorder appends one event per search on it. */
    readonly session?: {
        append(type: string, payload: unknown): void | Promise<unknown>;
    };
}

/** The agent registry, narrowed to the one lookup the recorder performs. */
export interface AgentRegistry {
    /** The Agent behind the current operation, or `undefined` outside an initiator boundary. */
    currentInitiator(): AgentSessionOwner | undefined;
}

/** The credential domain, narrowed to the resolver this plugin calls. */
export interface CredentialsAccessor {
    resolve(ref: string): Promise<{ readonly value?: string } | undefined>;
}

/** The launcher-owned environment snapshot, narrowed to one lookup. */
export interface EnvironmentAccessor {
    get(name: string): { readonly value?: string } | undefined;
}
