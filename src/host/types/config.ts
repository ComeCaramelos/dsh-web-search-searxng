/**
 * Host half — the plugin row's config shape.
 *
 * The shape is declared with the schema that validates it
 * (see {@link ../schema.ts schema}); this module re-states it so every public
 * type of the host half sits in one directory and the row can be read without
 * schemastery in the picture.
 *
 * Two faces of one row: `Config` is what `apply` receives (each field a live
 * volatile reference since dsh 0.2, or a plain value when composed by hand), and
 * `ConfigValues` is one plain read of it. Every field is optional: resolution
 * supplies a value for all of them per search (see {@link ../values.ts values}),
 * so a row that states nothing still drives a complete request.
 */
export type { Config, ConfigValues } from "../schema.js";
