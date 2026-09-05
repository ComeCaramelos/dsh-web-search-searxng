/**
 * Host half — the plugin row's config shape.
 *
 * The shape is declared with the schema that validates it
 * (see {@link ../schema.ts schema}); this module re-states it so every public
 * type of the host half sits in one directory and the row can be read without
 * schemastery in the picture.
 *
 * Every field is optional: resolution supplies a value for all of them per
 * search (see {@link ../values.ts values}), so a row that states nothing still
 * drives a complete request.
 */
export type { Config } from "../schema.js";
