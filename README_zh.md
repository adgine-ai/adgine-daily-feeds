# Adgine Daily Feeds

版本：`v0.2.0`

`adgine-daily-feeds` 是一个用于消费和分发中文 GEO/AEO 日报结果的 Codex Skill。推荐模式是 API-first：服务器生成日报 JSON，Skill 侧保持尽可能简单。

## 当前范围

`v0.2.0` 已支持：

- 优先消费 API 返回的日报结果。
- 通过搜狗微信搜索微信公众号文章。
- GEO/AEO 关键词监测。
- 文章质量评分。
- 生成用户可读的中文日报。
- 在外部解析完成后，回写微信公众号原文链接。
- 使用用户本地配置推送到 Telegram。

暂不支持：

- X/Twitter、Medium、Reddit、小红书、抖音、GitHub 或竞品监控。
- 直接调用微信私有 API。
- 稳定获取微信公众号阅读量、点赞、收藏、评论等互动指标。
- Skill 内置自动发送飞书。
- 内置推送凭证、receive_id、chat_id 或固定推送目标。

## 目录结构

```text
adgine-daily-feeds/
├── SKILL.md
├── VERSION
├── README.md
├── README_zh.md
├── agents/
│   └── openai.yaml
├── config/
│   └── destinations.example.json
├── references/
│   ├── api-report-schema.md
│   ├── report-format.md
│   ├── versioning.md
│   └── weixin-sogou.md
└── scripts/
    ├── apply-weixin-original-urls.mjs
    ├── capture-weixin-sogou.mjs
    ├── check-version.mjs
    ├── generate-daily-report.mjs
    └── telegram-send.mjs
```

## 使用方式

推荐 API 流程：

```text
GET /v1/reports/daily?date=YYYY-MM-DD&source=weixin_sogou
```

直接使用返回的 `report.sections` 做展示、Telegram 推送或 Web feed 渲染。具体结构见 `references/api-report-schema.md`。

本地 fallback 流程：

重新抓取并生成指定日期日报：

```bash
node skills/adgine-daily-feeds/scripts/generate-daily-report.mjs --end-date=2026-06-09
```

基于已有原始抓取数据生成日报：

```bash
node skills/adgine-daily-feeds/scripts/generate-daily-report.mjs --end-date=2026-06-09 --skip-capture
```

回写已解析的微信公众号原文链接：

```bash
node skills/adgine-daily-feeds/scripts/apply-weixin-original-urls.mjs \
  --feed=skills/adgine-daily-feeds/data/feed/cio-daily-10am-window-report-2026-06-09.json \
  --resolution=skills/adgine-daily-feeds/data/raw/weixin-original-url-resolution-2026-06-09.json \
  --markdown=skills/adgine-daily-feeds/reports/daily/2026-06-09-cio-daily-10am-window-report.md
```

检测本地 Skill 版本：

```bash
node skills/adgine-daily-feeds/scripts/check-version.mjs
```

和手动指定的最新版本比较：

```bash
node skills/adgine-daily-feeds/scripts/check-version.mjs --latest=v0.0.2
```

如果脚本返回 `is_outdated: true`，说明当前本地版本较旧，建议先手动更新 Skill，再用于生产任务。

## 推送配置

`v0.2.0` 支持可选 Telegram 推送，并预留了通用推送配置示例：

```text
skills/adgine-daily-feeds/config/destinations.example.json
```

使用时复制为本地配置文件：

```bash
cp skills/adgine-daily-feeds/config/destinations.example.json \
  skills/adgine-daily-feeds/config/destinations.local.json
```

当前示例预留：

- `feishu`
- `telegram`

真实凭证和推送目标只能写入本地配置文件，不要提交到开源仓库。`.gitignore` 已忽略本地配置文件。

给 bot 发消息后，查询 Telegram `chat_id`：

```bash
node skills/adgine-daily-feeds/scripts/telegram-send.mjs --list-updates
```

发送已生成的日报到 Telegram：

```bash
node skills/adgine-daily-feeds/scripts/telegram-send.mjs \
  --post-json=skills/adgine-daily-feeds/data/feed/cio-daily-10am-window-report-2026-06-09.json \
  --log=skills/adgine-daily-feeds/data/raw/telegram-send-2026-06-09.json
```

## 输出目录

API 输出应该是主要数据源。本地脚本输出尽量保持同样的 report 结构。

默认输出位置：

```text
skills/adgine-daily-feeds/data/raw/
skills/adgine-daily-feeds/data/feed/
skills/adgine-daily-feeds/reports/daily/
```

## 日报格式

用户版日报默认格式：

```text
CIO Daily 日报 | YYYY-MM-DD

来源：微信公众号 ｜ YYYY-MM-DD HH:mm

今日结论 ： ...

今日精选
...

延伸阅读
...

- @Adgine.ai beta
```

用户版原则：

- 只保留高质量或可扫读条目。
- 标题上保留可点击链接。
- 不展示长 URL。
- 不展示搜索词和完整评分细节。
- 每条内容提供一句 AI 推荐理由。

## 质量评分

当前评分参考 EEAT 思路：

- Experience：是否有案例、截图、实操细节或经验复盘。
- Expertise：是否正确理解 GEO/AEO，是否提供有用方法。
- Authoritativeness：是否来自可信账号、官方数据、报告或可引用来源。
- Trustworthiness：是否有来源链接，是否避免夸大承诺和软广话术。

分级：

- `must_read >= 80`
- `useful 60-79`
- `archive 45-59`
- `exclude < 45`

## 注意事项

- 保持 Skill 简单：获取或接收日报 JSON，然后展示或推送。
- 抓取、微信链接解析、评分、去重和定时任务应优先放在 API/服务器侧。
- 搜狗微信可能限流、拦截或返回不完整结果。
- 搜狗微信搜索结果页通常不提供阅读量、点赞、评论、收藏等数据。
- 部分搜狗跳转链接会过期，可能需要通过浏览器解析到 `mp.weixin.qq.com` 原文链接。
- 不要伪造互动数据或不可验证的来源信息。
- 推送必须由用户自行配置。不要把 App Secret、bot token、webhook、receive_id、chat_id 或 user_id 提交到开源 skill 中。

## 版本管理

当前版本：`v0.2.0`

版本规则：

- `v0.0.x`：文案、过滤规则、评分阈值、小修复。
- `v0.x.0`：新增数据源、输出模式、字段结构或自动化流程。
- `vX.0.0`：破坏性 schema 或 workflow 变更。
