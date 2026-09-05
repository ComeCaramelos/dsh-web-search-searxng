/**
 * Host half — the plugin's identity: its cordis name and the seam it injects
 * into.
 *
 * The name comes from {@link ./constants.ts constants}, the one place the
 * plugin's literal identifiers live; this module only re-states it under the
 * faces cordis reads (`name`, `inject`), so the loader's contract stays a
 * two-line read.
 */
import { PLUGIN_NAME } from "./constants.js";

/** Cordis plugin name (the plugin row's `name`), surfaced in loader diagnostics. */
export const name: string = PLUGIN_NAME;

/** The web capability seam this plugin registers its provider into. */
export const inject: string[] = ["web"];
