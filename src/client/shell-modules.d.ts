/**
 * Structural views of the modules the shell seeds into its module table.
 *
 * Only the two `@deepseek-ai/dsh-client-*` ids need describing: they resolve
 * inside the running GUI's module table and appear in no local `node_modules`
 * tree (no `@types/*` exists for them), so they are described here — the same
 * structural-view idiom the host half uses for services it does not depend on —
 * rather than imported. `react` and `react/jsx-runtime` are the baseline modules
 * that DO have local types (`@types/react` is a devDependency and stays external
 * in scripts/build-client.mjs), so those imports resolve normally.
 *
 * Keep each shape as narrow as what this half actually calls; widening them to
 * match upstream's real surface is a drift risk no test catches.
 */
declare module "@deepseek-ai/dsh-client-store" {
    /** A subscriber store: `getSnapshot` keeps identity, `set` notifies. */
    export interface SnapshotStore<T> {
        subscribe(listener: () => void): () => void;
        getSnapshot(): T;
        set(next: T): void;
    }

    /** Create a snapshot store seeded with `initial`. */
    export function createSnapshotStore<T>(initial: T): SnapshotStore<T>;
}

declare module "@deepseek-ai/dsh-client-ui-primitives" {
    /** The chevron every collapsible row draws: down while closed, up once open. */
    export const IconChevronDownOutline14: (props: { className?: string }) => import("react").ReactNode;
}
