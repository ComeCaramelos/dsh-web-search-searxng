/**
 * Host half — option resolution: settings → environment → constant.
 *
 * One search's whole option set is decided here, in one place, so a reader
 * asking "where did this value come from?" has exactly one answer. The chain is
 * deliberately the same for every field:
 *
 *   1. the settings section as it currently stands (the user layer wins over the
 *      composed layers);
 *   2. the launcher environment's variable of the matching name;
 *   3. the constant in {@link ./constants.ts constants}.
 *
 * The provider never sees a missing value: every field arrives fully defaulted
 * here, which is what lets `available()` stay a purely local check.
 *
 * The API key is not resolved here but handed over as a thunk — see
 * {@link ./credentials.ts credentials}, because a key that rotates between
 * searches must not be pinned by an earlier read.
 */
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import {
    SEARXNG_BASE_URL_ENV,
    SEARXNG_DEFAULT_BASE_URL,
    SEARXNG_DEFAULT_LANGUAGE,
    SEARXNG_DEFAULT_MAX_RESULTS,
    SEARXNG_LANGUAGE_ENV,
    SEARXNG_MAX_RESULTS_ENV
} from "./constants.js";
import { apiKeyEnvName, resolveApiKey } from "./credentials.js";
import type { Config } from "./schema.js";
import { recordSearchRequest } from "./recorder.js";
import type { PluginContext, SearxngSearchOptions } from "./types/index.js";

/**
 * Build the option set one search runs on.
 * @param ctx - the plugin context: supplies the launcher environment and the session the request is recorded on.
 * @param config - the config source as it stands right now (a fresh thunk result per search).
 * @returns the fully defaulted options for one search.
 */
export function resolveOptions(ctx: PluginContext, config: Config): SearxngSearchOptions {
    const environment = launchEnvironmentOf(ctx);

    return {
        apiKey: literalApiKey(config),
        resolveApiKey: resolveApiKey(ctx, config),
        apiKeyEnv: apiKeyEnvName(config),
        baseURL: settingsThenEnv(config.baseURL, SEARXNG_BASE_URL_ENV, environment) ?? SEARXNG_DEFAULT_BASE_URL,
        maxResults: resolveMaxResults(config.maxResults, environment),
        language: settingsThenEnv(config.language, SEARXNG_LANGUAGE_ENV, environment) ?? SEARXNG_DEFAULT_LANGUAGE,
        recordRequest: (request) => recordSearchRequest(ctx, request)
    };
}

/** A literal key only counts when it is a non-empty string. */
function literalApiKey(config: Config): string | undefined {
    const key = config.apiKey;
    return typeof key === "string" && key.length > 0 ? key : undefined;
}

/** Settings value → environment variable → `undefined` (the caller supplies the constant). */
function settingsThenEnv(
    configured: string | undefined,
    name: string,
    environment: ReturnType<typeof launchEnvironmentOf>
): string | undefined {
    if (typeof configured === "string" && configured.length > 0) return configured;
    const ambient = environment.get(name)?.value;
    return typeof ambient === "string" && ambient.length > 0 ? ambient : undefined;
}

/** A stated bound wins; else the environment variable; else the constant. */
function resolveMaxResults(
    configured: number | undefined,
    environment: ReturnType<typeof launchEnvironmentOf>
): number {
    if (typeof configured === "number" && Number.isFinite(configured)) return configured;
    const parsed = Number(environment.get(SEARXNG_MAX_RESULTS_ENV)?.value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : SEARXNG_DEFAULT_MAX_RESULTS;
}
