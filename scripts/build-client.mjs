/**
 * Build the browser half with esbuild.
 *
 * The shell's client manifest fetches exactly ONE script per bundle
 * (`/plugins/<id>/client.js`), loaded as a plain `<script>` — no import graph,
 * no `type="module"`, nothing behind a second URL. So the browser half can be
 * ordinary modules at source level but must collapse into one CJS-shaped
 * factory body at emit time, requiring only the ids the shell seeds into its
 * module table.
 *
 * Two steps, mirroring the host half's separation of check and emit:
 *
 *   1. `tsc -p src/client/tsconfig.json` typechecks the browser modules (no emit) —
 *      their imports resolve against the structural views in
 *      `src/client/shell-modules.d.ts` plus the DOM lib; the `*.module.css`
 *      imports typecheck against the ambient view in
 *      `src/client/styles/css-modules.d.ts`;
 *   2. this script runs esbuild over `src/client/index.ts`: bundle, CJS output,
 *      `platform: "neutral"` (no Node or DOM globals assumed), the four baseline
 *      ids kept external, and an external source map so the emitted bundle is
 *      debuggable back to `src/client/*.ts`. Stylesheets travel through it as CSS
 *      Modules (`*.module.css`, see the `dsh-css-modules` plugin below), so the
 *      one emitted file also carries every rule, minified and inlined.
 *
 * The bundle's shape is the loader's contract, not esbuild's: the factory
 * prologue/epilogue is supplied through esbuild's `banner`/`footer`, so the
 * generated body sits inside
 * `window.__ModuleLoader__.load({ id, factory: (require) => … })` exactly as
 * every other plugin's emitted half does.
 */
import { build } from "esbuild";
import postcss from "postcss";
import { readFile } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);
const ROOT_FS = fileURLToPath(ROOT);
const pkg = JSON.parse(await readFile(new URL("package.json", ROOT), "utf8"));

/**
 * Modules the shell seeds into `window.__ModuleLoader__` before this bundle
 * runs. They must stay external: bundling them would either duplicate the
 * shell's own copies (two Reacts) or, in the case of the `dsh-client-*`
 * packages, try to resolve ids that exist only inside the running GUI.
 */
const BASELINE_MODULES = [
    "react",
    "react/jsx-runtime",
    "@deepseek-ai/dsh-client-store",
    "@deepseek-ai/dsh-client-ui-primitives"
];

/**
 * CSS Modules — the way every shipped `dsh-client-ui-*` bundle carries its
 * stylesheets: each `<Component>.module.css` source is compiled into one
 * inlined module — minified CSS text plus a class map keyed by the source's
 * local class names, every name scoped `<hash>_<local>`.
 *
 * The validation step is postcss: every source is parsed by the CSS parser
 * stylelint itself uses, so invalid syntax fails `build:client` at the exact
 * line instead of degrading silently in the browser. (esbuild's CSS minifier is
 * deliberately lenient — it auto-closes an unclosed block and passes an extra
 * `}` straight through — so it is only the minifier here, never the checker.)
 */
const cssModules = {
    name: "dsh-css-modules",
    setup(api) {
        api.onResolve({ filter: /\.module\.css$/ }, (args) => ({
            path: resolve(args.resolveDir, args.path),
            namespace: "dsh-css"
        }));
        api.onLoad({ filter: /.*/, namespace: "dsh-css" }, async (args) => {
            const source = await readFile(args.path, "utf8");
            try {
                postcss.parse(source, { from: args.path });
            } catch (failure) {
                // CssSyntaxError carries reason/line/column; the reported line
                // text keeps esbuild's output pointing at the source line.
                const line = failure.line ?? 1;
                return {
                    errors: [{
                        text: failure.reason ?? String(failure),
                        location: {
                            file: args.path,
                            line,
                            column: failure.column ?? 1,
                            lineText: String(source.split(/\r?\n/)[line - 1] ?? "").trimEnd()
                        }
                    }]
                };
            }
            let minified;
            try {
                const result = await build({
                    stdin: {
                        contents: source,
                        sourcefile: basename(args.path),
                        loader: "css",
                        resolveDir: dirname(args.path)
                    },
                    bundle: true,
                    minify: true,
                    platform: "neutral",
                    logLevel: "silent",
                    write: false
                });
                minified = String(result.outputFiles[0].text);
            } catch (failure) {
                return { errors: failure.errors ?? [{ text: String(failure) }] };
            }
            // Scoping: one per-file prefix with the local name kept after it, so
            // the browser still shows which rule a class came from.
            const prefix = scopedName(relative(ROOT_FS, args.path).replace(/\\/g, "/"));
            const locals = [];
            const scoped = minified.replace(/\.([a-zA-Z_][\w-]*)/g, (_match, local) => {
                if (!locals.includes(local)) locals.push(local);
                return "." + prefix + "_" + local;
            });
            const styles = {};
            for (const local of locals) styles[local] = prefix + "_" + local;
            return {
                contents: ["export const cssText = " + JSON.stringify(scoped) + ";", "export default " + JSON.stringify(styles) + ";"].join("\n"),
                loader: "js"
            };
        });
    }
};

/**
 * The stable 6-character scope of one stylesheet: derived from the
 * repo-relative source path, so a class name never drifts with the absolute path
 * of the checkout a build happened to run in.
 *
 * The first character always comes from the alphabet. A CSS class selector may
 * not begin with a digit, and a selector that cannot be parsed is dropped
 * silently by the browser — a prefix that happened to start on a digit would
 * therefore style *nothing*, with nothing failing at build time and nothing
 * logged at runtime. Spreading the remaining characters keeps the collision
 * spread the hash carries.
 */
function scopedName(sourcePath) {
    let hash = 0x811c9dc5 >>> 0;
    for (let index = 0; index < sourcePath.length; index++) {
        hash ^= sourcePath.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    const digits = hash.toString(36).padStart(5, "0").slice(0, 5);
    return "abcdefghijklmnopqrstuvwxyz"[hash % 26] + digits;
}

await build({
    entryPoints: ["src/client/index.ts"],
    outfile: "lib/client.js",
    bundle: true,
    format: "cjs",
    platform: "neutral",
    target: "es2022",
    plugins: [cssModules],
    external: BASELINE_MODULES,
    sourcemap: "linked",
    sourcesContent: true,
    // The tsconfig is pinned instead of discovered. esbuild would otherwise walk
    // up from the entry and pick up `src/client/tsconfig.json` (the browser half's
    // own editor config), whose `strict: false` silently drops the CJS bundle's
    // `"use strict"` directive: the emitted factory body would run sloppy instead
    // of strict, a difference no test catches. Stating it here keeps strictness a
    // property of THIS bundle, independent of whichever config the editor happens
    // to read.
    tsconfigRaw: { compilerOptions: { strict: true } },
    banner: {
        js: [
            "window.__ModuleLoader__.load({",
            `\tid: ${JSON.stringify(pkg.name)},`,
            "\tfactory: (require) => {",
            "\t\tvar module = { exports: {} };",
            "\t\tvar exports = module.exports;",
            '\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });'
        ].join("\n")
    },
    footer: {
        js: ["\treturn module.exports;", "\t}", "});"].join("\n")
    }
});
