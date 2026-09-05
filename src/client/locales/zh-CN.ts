/**
 * Browser half — the Chinese dictionary.
 *
 * The same keys, so any missing key falls back to English rather than leaving a
 * blank in the card.
 */
export const zh: Record<string, string> = {
    title: "SearXNG",
    description: "SearXNG 元搜索提供方。",
    apiKey: "API 密钥",
    apiKeyHint: "不写入设置文件。留空表示保持当前密钥。无密钥的实例可以不填。",
    apiKeySet: "已配置密钥。",
    apiKeyUnset: "未配置密钥。",
    baseURL: "接口地址",
    baseURLHint: "SearXNG 基础地址。留空则使用提供方默认地址。",
    maxResults: "最多结果数",
    maxResultsHint: "一次搜索返回来源的上限。留空表示使用默认值。",
    language: "语言",
    languageHint: "搜索语言，填 'all' 表示不限。",
    overridden: "已覆盖",
    reset: "恢复默认",
    readOnly: "本部署的设置为只读。",
    expand: "展开设置",
    collapse: "收起设置",
    save: "保存",
    saving: "保存中…",
    discard: "放弃修改",
    unsaved: "未保存",
    saveFailed: "本部署没有接受这些值，已保留供你修改。",
    invalidNumber: "请填数字；留空表示使用默认值。"
};
