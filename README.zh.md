# @comecaramelos/dsh-web-search-searxng

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
- DeepSeek Harness **`^0.2.0`**（所有 0.2 构建，含 release candidate——`engines.dsh: "^0.2.0-0"`），并挂载了 `web` seam（所有标准 profile 都自带）。本包 `0.5.x` 是支持 dsh 0.1 的最后版本。
- [`@comecaramelos/dsh-ancesters`](../dsh-ancesters) `^0.2.0`：吸收 dsh 0.2 配置表面（行标识、配置表单、行配置页注册）的共享基础层，dsh 变动只需在那里修一次。它尚未发布到 npm：开发时链接同级检出目录（`file:../dsh-ancesters`，见 `devDependencies`）。

## 目录结构

源码为 TypeScript，位于 `src/`；`lib/` 是编译产物（不要手工修改）。这是 DSH
插件常见的两半结构：

```
src/index.ts             host 表面：标识、配置、apply、provider
src/provider.ts          单独的 provider，便于脱离插件行复用
src/host/apply.ts        接线：配置表单 + provider 注册
src/host/settings.ts     表单挂接（dsh-ancesters）与实时配置源
src/host/values.ts       选项解析：表单 → 环境变量 → 常量
src/host/credentials.ts  每次搜索的 API key 解析
src/host/recorder.ts     每次请求的会话事件（不含密钥）
src/host/request.ts      一次搜索发出的 URL 与请求头
src/host/provider.ts     provider 类
src/host/mapping.ts      SearXNG 响应 → 标准化的 sources
src/host/abort.ts        取消，统一收敛为 WEB_ABORTED
src/host/constants.ts    固定标识、默认值、请求头常量
src/host/schema.ts       行配置 schema——每个字段都是 volatile，因此它同时就是表单
src/client/**            浏览器半，打包为单个 lib/client.js
```

浏览器半单独编译，并由 `scripts/build-client.mjs`（esbuild）打包成
`lib/client.js`：shell 每个插件只取一个脚本，源码里的模块只为可读性存在，
并不构成运行时的模块图。共享的卡片机制（`@comecaramelos/dsh-ancesters/client`）
通过别名指向其纯 ESM 的 `client/source` 构建，一并打进同一个文件，因此产物仍然只依赖 shell 的种子模块。

## 安装

### 一键安装（bundle）

本包声明了 `dsh.bundle.patch`（`cordis.patch.yml`），因此一条 `dsh plugin add`
即可同时完成"注册插件 + 切换 web seam"，无需手动编辑任何 YAML：

```bash
dsh plugin --profile plugin-dev add @comecaramelos/dsh-web-search-searxng@link:/path/to/dsh-web-search-searxng
```

请在 `link:` 前写明包名——裸的 `link:<目录>` 会以目录名作为键，dsh 随后无法按包名解析该 bundle。请在 WSL 登录 shell（`bash -l`）中执行，让 dsh 调用 Linux 的 `pnpm`，而不是继承 `PATH` 中的 Windows 版本。然后在插件页启用该 bundle（或把它加入 profile 的 `dsh.profile.bundles`）。

配置优先走环境变量——启动 `dsh` 前设置即可，完全不用改配置（配置卡片留空的字段，每次搜索都会回退到它们）：

```bash
export SEARXNG_BASE_URL=http://localhost:8080   # 可选；默认 http://localhost:8080
export SEARXNG_MAX_RESULTS=10                    # 可选；默认 10
export SEARXNG_LANGUAGE=en                       # 可选；默认 'all'（不传该参数）
```

### 手动安装（本地开发）

```bash
# 1. 编译源码：`src/**` 是 TypeScript，harness 实际加载的是 `lib/**`
npm ci && npm run build

# 2. 让包能从 profile 的 node_modules 解析
ln -sfn /path/to/dsh-web-search-searxng \
        "$DSH_HOME/profiles/node_modules/@comecaramelos/dsh-web-search-searxng"

# 3. 在 cordis.patch.yml 中注册插件并切换搜索 provider（见下方配置）
```

```yaml
- insert:
    - id: web-search-searxng
      name: '@comecaramelos/dsh-web-search-searxng'

- id: web
  config:
    searchProvider: searxng-local
    fetchProvider: http
```

行 id `web-search-searxng` 是配置表单的键，请保持不变。

重启 DSH 进程（或 GUI）使 patch 生效。

> web profile 默认禁用 HMR 重载；修改 `cordis.patch.yml` 后需要重启进程。

## 测试

```bash
npm test   # 先构建，再 node --test test/*.test.mjs（68 个测试）
```

构建分两半：`tsc` 把 `src/host/**` 编译到 `lib/`；`tsc -p src/client/tsconfig.json` 只做类型检查，再由 `scripts/build-client.mjs` 用 esbuild 把浏览器半打包成 shell 取用的单个 classic-script `lib/client.js`。`lib/` 是生成产物——不要手工修改。

`test/provider.test.mjs` 通过公开的 `./provider` 表面驱动 provider（桩掉 `globalThis.fetch`）；`test/client.test.mjs` 按客户端模块加载器契约求值 `lib/client.js`（种子模块背后是真实 React，配合假的配置表单、插槽与凭据域），覆盖产物的模块边界、`plugins.bundle.config` 注册、页面形态，以及暂存、校验、保存和凭据处理；`test/wiring.test.mjs` 覆盖 host 侧 `apply()`、编译后的配置表单表面（每个字段都是 volatile）、实时配置源和选项优先级链。React 与 react-dom 仅作为客户端测试的 devDependencies；产物使用 shell 自带的 React。

## 配置

| 键 | 默认值 | 含义 |
|---|---|---|
| `baseURL` | `http://localhost:8080` | SearXNG 基础地址；自动追加 `/search`。未设置时回退到启动环境的 `$SEARXNG_BASE_URL`，再到默认值。无法解析时 provider 不可用。 |
| `maxResults` | `10` | 单次搜索返回来源数量上限（seam 也会强制执行自己的上限）。未设置时回退到 `$SEARXNG_MAX_RESULTS`，再到默认值。 |
| `language` | `all` | 搜索语言，作为 `language=...` 发送（如 `en`、`zh-CN`）。`'all'`（或未设置）时完全省略该参数。未设置时回退到 `$SEARXNG_LANGUAGE`。 |
| `apiKey` | 省略 | 字面量 SearXNG API key（当实例需要时）。优先用 `apiKeyEnv`，避免密钥进入配置文件；非空字面量优先。 |
| `apiKeyEnv` | `SEARXNG_API_KEY` | 每次搜索通过 `ctx.credentials` 解析的凭据引用，seam 缺失时从进程环境读取。本地无密钥实例缺省即可。 |

这些值可以在配置卡片（见下文）设置，也可以手写在你自己 profile 的 `cordis.patch.yml` 中——与页面写入的是同一个用户层：

```yaml
- id: web-search-searxng
  name: '@comecaramelos/dsh-web-search-searxng'
  config:
    baseURL: http://localhost:8080
    maxResults: 10
```

自 dsh 0.2 起不再有单独的设置命名空间：行配置**就是**配置表单。每个字段都是 `.volatile()`，表单以行的 profile 条目 id（`web-search-searxng`）为键，行自身的 `config:` 是基础层，profile patch 是用户层。provider 每次搜索都读取实时值，因此修改作用于**下一次**搜索，无需重启。`apiKey` 带 `role('secret')`，不会出现在 `describe()` 响应中。

随包的 `cordis.patch.yml` 有意**不**在该行声明 `config:`：在 dsh 0.2 下，行声明的任何值都会被下一次表单写入重新物化为用户层值，于是一次无关的保存之后每个字段都会显示"已覆盖"。字段保持未设置，上面的环境变量回退即生效。

## Web UI 配置页

本包还附带**浏览器半边**（`lib/client.js`，由 `package.json` 中的 `dsh.client` 声明）：Web UI **插件**页上本 bundle 自身页面里的配置卡片——在列表中点击 `@comecaramelos/dsh-web-search-searxng`，表单直接就在页面上，与内置的 Web search 条目打开方式相同，无需再进入 `web-search-searxng` 组件（组件行仍列在表单下方，但不再有自己的配置入口）。插件页负责绘制容器——面包屑、标题、包描述——卡片把内容注册到 `plugins.bundle.config` 插槽，键为包名（ancesters 的 `placement: "bundle"`）。

页面由 `@comecaramelos/dsh-ancesters` 的 `mountSettingsCard` 构建（字典、行表单上的控制器、带围栏的写入入口、已覆盖列表、插槽注册）；本包只声明描述符和一个内容区块（`src/client/card/body.ts`）：一个凭据字段、三个取值字段和 Save/Discard 页脚，使用同级卡片的字段样式表（`src/client/styles/SearxngCard.module.css`）。

| 字段 | 表单键 | 行为 |
|---|---|---|
| API 密钥 | 凭据域 | 只写控件——密钥字面量永不进入表单或响应；留空保持已存密钥。无密钥实例可以不填。徽章报告是否已配置密钥，并在 `credentials/reference-updated` 时重读。写入表单 `apiKeyEnv` 指定的凭据引用（缺省 `SEARXNG_API_KEY`）——该选项属于配置层，不是页面字段。 |
| 接口地址 | `baseURL` | SearXNG 基础地址；留空回退到 `$SEARXNG_BASE_URL`，再到默认值。 |
| 最多结果数 | `maxResults` | 不小于 1 的整数，按数字写入；非法草稿会阻止保存。 |
| 语言 | `language` | 留空回退到 `$SEARXNG_LANGUAGE`；`'all'` 表示省略该参数。 |

页面先暂存编辑，只在点击**保存**时写入；用户层携带的字段显示**已覆盖**徽章，可用**恢复默认**把它退回行自身的值（清空已覆盖字段再保存效果相同）。Host 未接受的保存会保留草稿供你修改。

自带的 DeepSeek "Web search" 页面是同一插件页上一个独立的官方条目（`plugins.item`，id `web-search`）；本包不再遮蔽它——0.1 时代在 `settings.plugin.item` 上的"墓碑"已移除。两个页面都可访问，由 `web.config.searchProvider`（bundle patch 已切换为 `searxng-local`）决定由哪个 provider 提供搜索。

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
