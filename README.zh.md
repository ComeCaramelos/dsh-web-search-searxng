# @deepseek-ai/dsh-web-search-searxng

[English](README.md) | 中文

为 DeepSeek Harness 的 [web 能力 seam](https://github.com/deepseek-ai/deepseek-harness)（`ctx.web`）提供基于 [SearXNG](https://docs.searxng.org/) 的 `WebSearchProvider`。它调用 SearXNG 实例的 JSON API（`/search?format=json`），把聚合结果映射为 seam 标准化的 `WebSearchResult`。

这是一个**实现包**：它向 `ctx.web` 注册 provider，通过 `ctx.credentials` 或进程环境解析可选的 API key，在有发起方 Agent 时把辅助请求记录到会话中，且不注册任何面向模型的工具。它是一个函数/命名空间插件（`inject: ['web']`）。

## 为什么用 SearXNG

- **自托管、隐私**：查询发往你自己的实例，不经过第三方搜索厂商。
- **每次搜索零模型成本**：与需要发起完整模型调用的厂商搜索不同，一次搜索只是一个 HTTP GET——又便宜又快。
- **多引擎聚合**：SearXNG 在一个端点后聚合 Bing、Brave、Baidu、Google、DuckDuckGo 等。
- **可移植**：把 `baseURL` 指向任意 SearXNG——本地 Docker、局域网实例或公共实例均可。

## 依赖

- 一个 DSH 主机可达的 SearXNG 实例（默认 `http://localhost:8080`）。
- 挂载了 `web` seam 的 DeepSeek Harness profile（所有标准 profile 都自带）。

## 安装

### 一键安装（bundle）

本包声明了 `dsh.bundle.patch`（`cordis.patch.yml`），因此一条 `dsh plugin add`
即可同时完成"注册插件 + 切换 web seam"，无需手动编辑任何 YAML：

```bash
dsh plugin --profile web add /path/to/dsh-web-search-searxng
```

配置优先走环境变量——启动 `dsh` 前设置即可，完全不用改配置：

```bash
export SEARXNG_BASE_URL=http://localhost:8080   # 可选；默认 http://localhost:8080
export SEARXNG_MAX_RESULTS=10                    # 可选；默认 10
export SEARXNG_LANGUAGE=en                       # 可选；默认 'all'（不传该参数）
```

### 手动安装（本地开发）

```bash
# 1. 让包能从 profile 的 node_modules 解析
ln -sfn /path/to/dsh-web-search-searxng \
        "$DSH_HOME/profiles/node_modules/@deepseek-ai/dsh-web-search-searxng"

# 2. 在 cordis.patch.yml 中注册插件并切换搜索 provider（见下方配置）
```

```yaml
- insert:
    - id: web-search-searxng
      name: '@deepseek-ai/dsh-web-search-searxng'
      config:
        baseURL: http://localhost:8080
        maxResults: 10

- id: web
  config:
    searchProvider: searxng-local
```

重启 DSH 进程（或 GUI）使 patch 生效。

> web profile 默认禁用 HMR 重载；修改 `cordis.patch.yml` 后需要重启进程。

## 测试

```bash
npm test   # = node --test tests/provider.spec.js tests/client.spec.js（35 个测试，零依赖）
```

`tests/client.spec.js` 在模拟的客户端模块加载器中（桩化的平台模块 + 设置 scope + 凭据接口）求值 `lib/client.js`，覆盖工厂的模块边界、`apply()` 接线，以及卡片的暂存、校验、保存和凭据处理。

## 配置

| 键 | 默认值 | 含义 |
|---|---|---|
| `baseURL` | `http://localhost:8080` | SearXNG 基础地址；自动追加 `/search`。可从任意环境层的 `$SEARXNG_BASE_URL` 回退。无法解析时 provider 不可用。 |
| `maxResults` | `10` | 单次搜索返回来源数量上限（seam 也会强制执行自己的上限）。 |
| `language` | `all` | 搜索语言，作为 `language=...` 发送（如 `en`、`zh-CN`）。`'all'`（或未设置）时完全省略该参数。可从 `$SEARXNG_LANGUAGE` 回退。 |
| `apiKey` | 省略 | 字面量 SearXNG API key（当实例需要时）。优先用 `apiKeyEnv`，避免密钥进入配置文件；非空字面量优先。 |
| `apiKeyEnv` | `SEARXNG_API_KEY` | 每次搜索通过 `ctx.credentials` 解析的凭据引用，seam 缺失时从进程环境读取。本地无密钥实例缺省即可。 |

```yaml
- id: web-search-searxng
  name: '@deepseek-ai/dsh-web-search-searxng'
  config:
    baseURL: http://localhost:8080
    maxResults: 10
```

以上条目是 `web-search-searxng` 设置区块的基础层：用户层对其覆盖会作用于**下一次**搜索，因为 provider 是每次调用时投影配置段，而不是在注册时快照。`apiKey` 带 `role('secret')`，不会出现在任何层的 `describe()` 响应中。

## Web UI 设置卡片

本包还附带**浏览器半边**（`lib/client.js`，由 `package.json` 中的 `dsh.client` 声明）：Web UI **设置 → 插件 → 插件配置**页中的网络搜索卡片，上面的每个值都可以在卡片里编辑。

卡片保留 harness 为 `web-search-deepseek` 命名空间自带的 "Web search" 卡片（`dsh-client-ui-settings-plugins`）的外观——同样的边框、同样的字段设计——只是把文案更新为它实际编辑的 SearXNG 提供方（标题 "SearXNG"，描述 "The SearXNG meta-search provider."）。为了不出现第二张重复 API 密钥 / 接口地址 / 上限字段的卡片，本包直接接管那个席位：以 priority -1 在 `web-search-deepseek` 键下注册一个空渲染的"墓碑"（键控插槽渲染优先级最低者，因此自带卡片被遮蔽），卡片本身（编辑 `web-search-searxng` 区块）注册在自身键下：

| 卡片字段 | 区块键 | 行为 |
|---|---|---|
| API 密钥 | 凭据域 | 只写控件——密钥字面量永不进入响应；留空保持已存密钥。无密钥实例可以不填。徽章报告是否已配置密钥，并在 `credentials/reference-updated` 时重读。写入 `apiKeyEnv` 指定的凭据引用（缺省 `SEARXNG_API_KEY`）——该选项属于配置层，不是卡片字段。 |
| 接口地址 | `baseURL` | SearXNG 基础地址；留空回退到组合层值，再到默认值。 |
| 最多结果数 | `maxResults` | 不小于 1 的整数；非法草稿会阻止保存。 |
| 语言 | `language` | 留空回退继承；`'all'` 表示省略该参数。 |

卡片先暂存编辑，只在点击**保存**时写入：每个字段都是 `web-search-searxng` 设置命名空间上一次带修订号围栏的文档变更；用户层携带的字段显示**已覆盖**徽章（可一键恢复组合值）；Host 未接受的保存会保留草稿供你修改。改动在**下一次**搜索生效——无需重启。

本包向共享的 `settings.plugin.item` 插槽注册两次：`web-search-deepseek` 键下空渲染的墓碑（保留 DeepSeek 区块的席位但不显示卡片），以及自身 `web-search-searxng` 键下的卡片本身，区块可用即渲染——因此没有 DeepSeek 提供方的部署（例如 profile 中禁用了 `web-search-deepseek` 行）仍能到达 SearXNG 设置。插件配置页按注册条目的键（∩ Host 服务的命名空间）构建单元格列表且不去重，所以墓碑必须渲染为空：若在那里放可见组件，它会按声明该键的条目数量重复出现。页面只在 Host 服务对应命名空间时才派发某个键，因此未安装本包的部署看不到任何痕迹。DeepSeek 提供方本身不受影响：仍可通过 `web.config.searchProvider` 选择，只是不再有卡片。

> Host 在进程启动时扫描 `dsh.client` 声明，所以安装或升级到携带浏览器半边的版本后，需要重启一次 DSH 进程（或 GUI）。web profile 默认禁用 HMR。

## 限流说明（Docker Desktop 下的本地 Docker）

当 SearXNG 跑在 Docker Desktop 里时，来自宿主机的请求到达容器时 `REMOTE_ADDR` 是 compose **网关 IP**（如 `172.18.0.1`）而非 `127.0.0.1`。SearXNG 限流器会把它当作外部客户端，对 JSON API 返回 429（`API_MAX = 4 次/小时`）。本 provider 每次请求都发送 `X-Forwarded-For: 127.0.0.1`；配合 `limiter.toml` 中 `trusted_proxies = ['127.0.0.0/8']` 以及回环段和 Docker 网段的 `pass_ip` 白名单，本地客户端可以完全绕过 JSON API 配额。

如果你的 SearXNG 是远程实例（局域网/云），请相应移除该头，或在服务端调整 `trusted_proxies`/`pass_ip`。

## 结果映射

SearXNG 返回的 provider 生成答案本 provider 不信任为 `content`，因此省略。`sources[]` 来自 `results[]`：`url` ← `url`、`title` ← `title`、`snippet` ← `content`、`publishedAt` ← `publishedDate`。按 URL 去重。

provider 失败表现为 `WEB_PROVIDER_ERROR`；调用方取消表现为 `WEB_ABORTED`。HTTP 重定向会被跟随（SearXNG 可能对 blob/重定向端点返回 307）。

## 请求日志

在发起方 Agent 下执行的搜索，会在派发前把仅日志用途的 `web/searxng-search-request` 会话事件写入会话，包含解析后的端点和查询（不含密钥）。Agent 之外的直接程序化调用没有发起会话可记录。

## License

MIT
