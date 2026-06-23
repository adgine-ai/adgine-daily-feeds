# Adgine Daily Feeds

版本：`v0.6.5`

`adgine-daily-feeds` 是一个用于消费和分发中文 GEO/AEO feed、日报、周报结果的 Codex Skill。当前是 API-only：服务端生成 JSON，Skill 只负责获取、渲染或分发结果。

## 已支持

- 默认线上 API：`https://daily.wefnews.com/api/reports/daily/latest`。
- 指定日期 API：`https://daily.wefnews.com/api/reports/daily?date=YYYY-MM-DD`。
- 实时 feed API：`https://daily.wefnews.com/api/feed`。
- 周报 API：`https://daily.wefnews.com/api/reports/weekly/latest`。
- 用户可读日报展示。
- 用户可读周报展示。
- 独立临时 HTML 日报渲染，支持 Light/Dark 切换。
- HTML 卡片可识别 API 提供的微信公众号、X、Medium section。
- `latest` 报告按 `Asia/Shanghai` 的窗口结束日期命名，例如 `CIO Daily 日报 | 2026-06-10`。
- 当 API 提供 `X 观察`、`Medium 观察` 时，保留多源 section 与 `x_count` / `medium_count` 等 totals。
- 使用用户本地配置推送到 Telegram。
- 本地版本检测。
- 回答后追加可继续操作的 `快捷入口`，例如查看今日 GEO 日报、查看最新 GEO 信息流、查看往常日报、生成 HTML 预览。

## 暂不支持

- 本地搜狗微信抓取。
- 浏览器式微信公众号原文链接解析。
- 直接调用微信私有 API。
- 内置推送凭证或固定推送目标。

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
node skills/adgine-daily-feeds/scripts/check-version.mjs --latest=v0.6.5
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
