/**
 * Browser half — the Chinese dictionary.
 *
 * The same keys, so any missing key falls back to English rather than leaving a
 * blank on the page.
 */
export const zh: Record<string, string> = {
    apiKey: "API 密钥",
    apiKeyHint: "由凭据服务保存，不写入配置文件。留空表示保持当前密钥。无密钥的实例可以不填。",
    apiKeySet: "已配置",
    apiKeyUnset: "未配置",
    baseURL: "接口地址",
    baseURLHint: "SearXNG 基础地址。留空则使用 $SEARXNG_BASE_URL 或默认地址。",
    baseURLPlaceholder: "http://localhost:8080",
    maxResults: "最多结果数",
    maxResultsHint: "一次搜索返回来源的上限。留空则使用 $SEARXNG_MAX_RESULTS 或默认值。",
    maxResultsPlaceholder: "10",
    language: "语言",
    languageHint: "搜索语言，填 'all' 表示不限。留空则使用 $SEARXNG_LANGUAGE 或 'all'。",
    languagePlaceholder: "all",
    overridden: "已覆盖",
    reset: "恢复默认",
    readOnly: "本部署的配置为只读。",
    save: "保存",
    saving: "保存中…",
    discard: "放弃修改",
    saveFailed: "本部署没有接受这些值，已保留供你修改。",
    invalidNumber: "请填不小于 1 的整数；留空表示使用默认值。"
};
