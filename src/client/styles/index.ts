/**
 * Browser half — the stylesheet surface.
 *
 * The rules and their names live in `SearxngCard.module.css`; the build's
 * CSS-modules step compiles them — postcss-checked, minified, names scoped
 * `hash_local` — and the components import the map directly, the way every
 * shipped `dsh-client-ui-*` card consumes its own stylesheet. What is left here
 * is only the one-shot injection.
 *
 * The idiom is the one every other plugin card uses: a `style` element tagged
 * with the plugin id, so a re-materialized bundle never stacks a second copy. It
 * is called from `apply`, never from a module body, so importing a module for its
 * class names cannot have DOM side effects.
 */
import { PLUGIN_ID } from "../plugin-meta.js";
import { cssText } from "./SearxngCard.module.css";

/** The injected element's identity: `<plugin id>/<card>.module.css`. */
const CARD_CSS_ID = `${PLUGIN_ID}/SearxngCard.module.css`;

/**
 * Append the card's stylesheet, once.
 *
 * Idempotent by construction: the element is tagged with the plugin id plus the
 * stylesheet's id, so re-applying the bundle is a no-op.
 */
export function injectCardStyles(): void {
    if (typeof document === "undefined") return;
    if (document.querySelector(`style[data-plugin-css="${CARD_CSS_ID}"]`) !== null) return;
    const styleTag = document.createElement("style");
    styleTag.dataset.plugin = PLUGIN_ID;
    styleTag.dataset.pluginCss = CARD_CSS_ID;
    styleTag.textContent = cssText;
    document.head.appendChild(styleTag);
}
