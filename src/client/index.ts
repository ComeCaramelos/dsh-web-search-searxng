/**
 * @comecaramelos/dsh-web-search-searxng — browser half, public surface.
 *
 * The one module the bundler walks, so the emitted `client.js` exports exactly
 * what the shell consumes: `apply` (mount the card) and `inject` (the services
 * this half needs). Everything behind these re-exports stays an implementation
 * detail, so tests import the bundle rather than a module inside it.
 *
 * Re-export only: nothing here decides anything.
 */
export { apply } from "./apply.js";
export { inject } from "./plugin-meta.js";
