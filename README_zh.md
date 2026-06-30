# Adgine Daily Feeds

版本：`v0.6.8`

`adgine-daily-feeds` 是一个用于消费和分发中文 GEO/AEO feed、日报、周报结果的 Codex Skill。当前是 API-only：服务端生成 JSON，Skill 只负责获取、渲染或分发结果。

## Agent 接入定位

这一版把 Skill 的使用方式收敛成一个 Agent 入口，而不是只暴露脚本命令：

- 默认宽问题走实时 feed，因为 feed 是主动阅读和发现信号的入口。
- 明确说“日报”才走日报接口，明确说“周报”才走周报接口。
- 明确说“公众号 / X / Twitter / Medium”时，优先使用当前 feed API 和脚本支持的 `source` 过滤。
- 明确说“最近 N 天 / 从 A 到 B”时，使用 feed 时间窗参数。
- 明确说“HTML / 预览 / 生成页面”时，生成独立 HTML。
- 对当前 API 没有返回的数据，必须说明“当前 API 未返回”，不能假设平台没有内容。

当前可公开说明的接入面：

- Skill：`SKILL.md` 标准和 bundled scripts。
- REST API：`daily.wefnews.com` 已有 JSON 端点。
- HTML：本地独立预览页。
- Telegram：用户本地配置后可选发送。

Roadmap，不应写成已支持：

- 公开 `/agent` 接入页。
- 公开托管的 `SKILL.md` / install script。
- RSS。
- OpenAPI。
- 服务端 `q` 关键词搜索和更细的 topic filter。

## 已支持

- 默认线上 API：`https://daily.wefnews.com/api/reports/daily/latest`。
- 指定日期 API：`https://daily.wefnews.com/api/reports/daily?date=YYYY-MM-DD`。
- 实时 feed API：`https://daily.wefnews.com/api/feed`。
- 周报 API：`https://daily.wefnews.com/api/reports/weekly/latest`。
- 用户可读日报展示。
- 用户可读周报展示。
- 独立临时 HTML 日报渲染，支持 Light/Dark 切换。
- HTML 卡片可识别 API 提供的微信公众号、X、Medium section。
- `latest` 报告按 `Asia/Shanghai` 的窗口结束日期命名，例如 `Adgine Daily 日报 | 2026-06-10`。
- 当 API 提供 `X 观察`、`Medium 观察` 时，保留多源 section 与 `x_count` / `medium_count` 等 totals。
- 使用用户本地配置推送到 Telegram。
- 本地版本检测。
- 回答后追加可继续操作的 `快捷入口`，例如查看今日 GEO 日报、查看最新 GEO 信息流、查看往常日报、生成 HTML 预览。
- 默认能力菜单：当用户问“这个 skill 能做什么”或没有给出明确任务时，先罗列可用功能，再建议从最新 feed 或今日日报开始。
- 媒体日报分析：围绕固定日报做结论、主题、来源、精选内容、风险和行动建议分析。
- Feed 深度分析：围绕滚动信息流做新增信号、重复主题、来源分布、优先阅读、Wiki 候选和后续追踪分析。
- 机会判断：把日报和 feed 中反复出现的信号转成可执行的市场/内容/产品机会判断。
- Agent 意图路由：默认 feed，日报/周报/来源/时间窗/HTML 请求走对应端点或脚本参数。

## 暂不支持

- 本地搜狗微信抓取。
- 浏览器式微信公众号原文链接解析。
- 直接调用微信私有 API。
- 内置推送凭证或固定推送目标。
- 公开 RSS、OpenAPI、托管安装页或服务端关键词搜索。

## 目录结构

```text
adgine-daily-feeds/
├── SKILL.md
├── VERSION
├── agents/
│   └── openai.yaml
├── config/
│   └── destinations.example.json
├── references/
│   ├── api-report-schema.md
│   └── versioning.md
└── scripts/
    ├── check-version.mjs
    ├── fetch-daily-report-api.mjs
    ├── render-daily-report-html.mjs
    └── telegram-send.mjs
├── templates/
│   └── daily-report.html
```

## API 使用方式

拉取最新线上日报：

```bash
node skills/adgine-daily-feeds/scripts/fetch-daily-report-api.mjs --report
```

拉取默认实时 feed：

```bash
node skills/adgine-daily-feeds/scripts/fetch-daily-report-api.mjs
```

拉取指定日期：

```bash
node skills/adgine-daily-feeds/scripts/fetch-daily-report-api.mjs --date=2026-06-09
```

保存线上日报到本地：

```bash
node skills/adgine-daily-feeds/scripts/fetch-daily-report-api.mjs \
  --output=skills/adgine-daily-feeds/data/feed/latest-report.json
```

拉取最新周报：

```bash
node skills/adgine-daily-feeds/scripts/fetch-daily-report-api.mjs --weekly
```

拉取指定周报区间：

```bash
node skills/adgine-daily-feeds/scripts/fetch-daily-report-api.mjs \
  --weekly \
  --start-date=2026-06-08 \
  --end-date=2026-06-12
```

直接使用返回的 `report.sections` 做展示、Telegram 推送或 Web feed 渲染。具体结构见 `references/api-report-schema.md`。

如果 API 返回 `X 观察` 或 `Medium 观察` section，保持它们在 `report.sections` 中即可。HTML 渲染器会自动读取 `source.platform` / `source_platform`、`summary`、`tags`、`metrics`。

注意：

- `latest` 表示“当前线上可用的最新窗口日报”，不保证一定等于当前自然日；如果线上部署或数据发布滞后，`latest` 可能暂时还指向上一期。
- `report.title` / `date` 是日报窗口结束日期，不等于每篇文章自己的发布时间。
- 不要从前一天 report 推断今天也一定有 `X / Medium` section；必须以 API 当次返回为准。
- 回答日报时应说明实际报告日期和 slot/window；如果用户说“今日”但 `latest` 不是今天，要明确提示最新可用日期。
- 生成 JSON 或 HTML 后，应在回答中列出产物路径、来源 API 或输入文件、报告日期和 slot/window。

## 意图路由规则

| 用户意图 | 默认动作 |
|---|---|
| 最新 GEO 动态、今天有什么值得关注 | 拉取 `/api/feed` 默认滚动窗口 |
| 日报、今日日报、某天日报 | 拉取 latest 或指定日期日报 |
| 周报、本周回顾 | 拉取 latest 或指定区间周报 |
| 公众号 / X / Twitter / Medium | 使用 feed `source` 过滤 |
| 最近 N 天 / 从 A 到 B | 使用 `--start-at` / `--end-at` |
| HTML / 预览 / 生成页面 | 调用 HTML renderer |
| 能做什么 / 没有明确任务 | 先输出默认能力菜单 |

当前脚本支持的 feed 参数：

```bash
node skills/adgine-daily-feeds/scripts/fetch-daily-report-api.mjs \
  --source=x \
  --start-at="2026-06-25 10:00" \
  --end-at="2026-06-26 09:42" \
  --limit=50
```

## 快捷入口体验

Skill 回答 feed、日报、周报或版本检查后，默认追加简短的 `快捷入口`：

```text
快捷入口：
- 查看今日 GEO 日报
- 查看最新 GEO 信息流
- 查看往常日报
- 生成 HTML 预览
- 生成本周 GEO 周报
```

如果用户选择“查看往常日报”但没有给日期，应提示使用 `YYYY-MM-DD`，例如 `查看 2026-06-22 GEO 日报`。

如果 API 请求失败或指定日期没有数据，回答应分成 `数据状态`、`可能原因`、`下一步建议`，避免只输出脚本错误。

## 默认能力菜单

当用户只问 `adgine-daily-feeds 能做什么`、`默认有哪些功能`、`帮我分析日报/feeds`，或者没有给出非常具体的任务时，默认先输出功能菜单：

```text
adgine-daily-feeds 默认能力
1. 最新信息流：查看 rolling feed，按来源、时间、主题快速扫一遍。
2. 日报解读：查看最新或指定日期日报，说明真实日期、slot/window 和核心结论。
3. 媒体日报分析：把日报当作媒体情报，分析结论质量、主题分布、来源结构和阅读路径。
4. Feed 深度分析：把 feed 当作实时信号流，分析新增信号、重复主题、来源分布和可追踪对象。
5. 周报回顾：按周总结主题趋势、重复信号和优先阅读内容。
6. HTML / Telegram 输出：生成独立 HTML 预览，或用本地配置推送到 Telegram。

默认建议：先看最新信息流，再对今日日报做主题聚类和机会判断。
```

不要脱离 API 当次返回来承诺覆盖范围。只有当返回中确实包含 X、Medium、微信公众号或具体账号时，才在回答里点名。

## 分析模式

### 媒体日报分析

适用于已经生成好的日报。它不是简单复述文章，而是回答“今天这些媒体信息说明了什么”。

默认输出：

```text
媒体日报分析 | YYYY-MM-DD / slot

1. 今日核心判断
2. 主题分布
3. 来源结构
4. 高价值内容
5. 弱信号与风险
6. 今日行动建议
7. 明日追踪点
```

规则：

- 优先使用 `report.sections`，尤其是 `今日结论`、`今日精选`、`延伸阅读`、`X 观察`、`Medium 观察`。
- 优先使用 API 已给出的 quality / score / recommendation，不自行编造阅读量、点赞、评论等指标。
- 如果 X / Medium / 某个平台缺失，要说“当前 API 未返回”，不要推断为平台没有内容。

### Feed 深度分析

适用于 `/api/feed` 滚动信息流。它关注“现在正在出现什么”。

默认输出：

```text
Feeds 分析 | window

1. 新增信号
2. 重复出现的主题
3. 来源/平台分布
4. 值得立即阅读
5. 可以进入 Wiki/素材库的内容
6. 需要继续追踪的账号/关键词
```

规则：

- 保留关键字段语义：`id`、`href`、`slot`、`captured_display`、`published_display`、`section_title`。
- 叙述时可以按主题去重，但不要改写或删除原始 JSON 项。
- 如果存在 item id，要提示后续可用于去重、阅读状态和收藏状态。

### 机会判断

适用于用户问“有什么机会”“今天应该做什么”“市场有什么变化”。

默认输出：

```text
机会判断
- 机会：...
- 证据：来自哪些日报/feed 信号
- 适合谁：...
- 今天能做：...
- 风险：...
- 下一次验证：...
```

机会判断必须从日报或 feed 证据出发，不要把每个热点都包装成机会。

## HTML 模板

把最新线上日报渲染为独立 HTML 文件：

```bash
node skills/adgine-daily-feeds/scripts/render-daily-report-html.mjs \
  --output=skills/adgine-daily-feeds/data/html/latest-report.html
```

默认是 light。生成的 HTML 页面内也有 Light/Dark 切换。如果希望首次打开就是 dark：

```bash
node skills/adgine-daily-feeds/scripts/render-daily-report-html.mjs \
  --theme=dark \
  --output=skills/adgine-daily-feeds/data/html/latest-report.html
```

渲染指定日期：

```bash
node skills/adgine-daily-feeds/scripts/render-daily-report-html.mjs \
  --date=2026-06-09 \
  --output=skills/adgine-daily-feeds/data/html/2026-06-09.html
```

从已保存的 API 结果渲染：

```bash
node skills/adgine-daily-feeds/scripts/render-daily-report-html.mjs \
  --input=skills/adgine-daily-feeds/data/feed/latest-report.json \
  --output=skills/adgine-daily-feeds/data/html/latest-report.html
```

渲染周报：

```bash
node skills/adgine-daily-feeds/scripts/render-daily-report-html.mjs \
  --weekly \
  --output=skills/adgine-daily-feeds/data/html/latest-weekly.html
```

## 版本检测

```bash
node skills/adgine-daily-feeds/scripts/check-version.mjs
```

和手动指定的最新版本比较：

```bash
node skills/adgine-daily-feeds/scripts/check-version.mjs --latest=v0.6.8
```

当 `--latest` 高于本地版本时，脚本会返回类似 lark-cli 的更新提示：

```json
{
  "_notice": {
    "update": {
      "command": "git pull",
      "current": "v0.6.8",
      "latest": "v0.6.9",
      "message": "adgine-daily-feeds v0.6.9 available, current v0.6.8, run: git pull"
    }
  }
}
```

版本策略：常规发布沿用 GitHub 当前 minor 版本线，只升级最后一位。不要因为语义化版本判断自动升级到新的 minor 或 major 版本，这两个版本线由用户人工决定。

生产验证建议：从 GitHub 下载或 clone 到临时目录后运行版本检查和渲染测试，不要默认更新 WorkBuddy 本地 skill 缓存。

## 推送配置

Skill 支持可选 Telegram 推送，并预留了通用推送配置示例：

```text
skills/adgine-daily-feeds/config/destinations.example.json
```

使用时复制为本地配置文件：

```bash
cp skills/adgine-daily-feeds/config/destinations.example.json \
  skills/adgine-daily-feeds/config/destinations.local.json
```

不要提交真实凭证或推送目标。

发送已保存日报到 Telegram：

```bash
node skills/adgine-daily-feeds/scripts/telegram-send.mjs \
  --post-json=skills/adgine-daily-feeds/data/feed/latest-report.json \
  --log=skills/adgine-daily-feeds/data/feed/telegram-send-latest.json
```
