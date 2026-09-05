/**
 * Browser half — the dictionaries the shell's locale service serves.
 *
 * Registered wholesale under the plugin's namespace; `en` is the tag every other
 * tag resolves missing keys through, so a key the shell asks for is never blank.
 *
 * Keeping both dictionaries in this directory — rather than inline in the card —
 * is what lets the markup render only ever `t("…")`.
 */
import { en } from "./en-US.js";
import { zh } from "./zh-CN.js";

/** tag → dictionary, registered under the plugin's locale namespace. */
export const DICTIONARIES: Record<string, Record<string, string>> = { en, zh };

/** Every tag registered; the first is the fallback. */
export const TAGS = ["en", "zh"];
