/**
 * Host half — the API key, resolved for each search.
 *
 * Two sources, in order:
 *
 *   1. a literal `apiKey` on the config (never sent through the credential
 *      domain, and never recorded — `role("secret")` keeps it off `describe()`);
 *   2. the credential reference named by `apiKeyEnv`, resolved through the
 *      credentials seam when the composition mounts one, else through the
 *      launcher environment's variable of the same name.
 *
 * Absence is a valid state, not a failure: a keyless local SearXNG answers
 * without one. Only an error *talking to* the seam is an error — the caller turns
 * it into a `WEB_PROVIDER_ERROR`.
 *
 * The reference is resolved afresh on every search rather than cached: a
 * credential that rotates between searches must reach the very next request, and
 * cordis may mount the credentials service after `apply` ran.
 */
import type { CredentialProvider, CredentialRef } from "@deepseek-ai/dsh-credentials";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import { DEFAULT_API_KEY_ENV } from "./constants.js";
import type { Config } from "./schema.js";
import type { PluginContext } from "./types/index.js";

/**
 * The credential reference the key lives under, as its plain name.
 *
 * A section that states no reference still points somewhere stable, so the GUI's
 * key control and the host's resolution never disagree about the address.
 */
export function apiKeyEnvName(config: Config | undefined): string {
    const declared = config?.apiKeyEnv;
    return typeof declared === "string" && declared.length > 0 ? declared : DEFAULT_API_KEY_ENV;
}

/** The same reference, branded for the credentials seam. */
export function apiKeyRef(config: Config | undefined): CredentialRef {
    return credentialRef(apiKeyEnvName(config));
}

/**
 * Build the per-search key resolver.
 * @param ctx - the plugin context: the credentials seam when mounted, else the launcher environment.
 * @param config - the config source as it stands now.
 * @returns a thunk resolving the key, or `undefined` when this instance is keyless.
 */
export function resolveApiKey(ctx: PluginContext, config: Config | undefined): () => Promise<string | undefined> {
    const ref = apiKeyRef(config);
    return async () => {
        // `strict: false`: a composition may mount no credentials domain at all,
        // and the launch-environment lookup below is then the only source.
        const credentials = ctx.get("credentials", false) as CredentialProvider | undefined;
        if (credentials !== undefined) {
            const resolved = await credentials.resolve(ref);
            return nonEmpty(resolved?.value);
        }
        return nonEmpty(launchEnvironmentOf(ctx).get(ref)?.value);
    };
}

/** An empty stored value is absent everywhere; treat it as no key. */
function nonEmpty(value: string | undefined): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
