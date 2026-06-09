# Adgine Daily Feeds

版本：`v0.4.0`

`adgine-daily-feeds` 是一个用于消费和分发中文 GEO/AEO 日报结果的 Codex Skill。当前是 API-only：服务端生成日报 JSON，Skill 只负责获取、展示或分发结果。

## 已支持

- 默认线上 API：`https://daily.wefnews.com/api/reports/daily/latest`。
- 指定日期 API：`https://daily.wefnews.com/api/reports/daily?date=YYYY-MM-DD`。
- 用户可读日报展示。
- 独立临时 HTML 日报渲染。
- 使用用户本地配置推送到 Telegram。
- 本地版本检测。

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

直接使用返回的 `report.sections` 做展示、Telegram 推送或 Web feed 渲染。具体结构见 `references/api-report-schema.md`。

## HTML 模板

把最新线上日报渲染为独立 HTML 文件：

```bash
node skills/adgine-daily-feeds/scripts/render-daily-report-html.mjs \
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

## 版本检测

```bash
node skills/adgine-daily-feeds/scripts/check-version.mjs
```

和手动指定的最新版本比较：

```bash
node skills/adgine-daily-feeds/scripts/check-version.mjs --latest=v0.4.0
```

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
