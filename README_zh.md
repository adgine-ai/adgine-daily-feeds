# Adgine Daily Feeds

版本：`v0.1.0`

`adgine-daily-feeds` 是一个用于生成中文 GEO/AEO 日常信息流的 Codex Skill。当前版本以微信公众号信息流为主，通过搜狗微信搜索采集相关文章，并生成可阅读的日报。

## 当前范围

`v0.1.0` 已支持：

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

`v0.1.0` 支持可选 Telegram 推送，并预留了通用推送配置示例：

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

- 搜狗微信可能限流、拦截或返回不完整结果。
- 搜狗微信搜索结果页通常不提供阅读量、点赞、评论、收藏等数据。
- 部分搜狗跳转链接会过期，可能需要通过浏览器解析到 `mp.weixin.qq.com` 原文链接。
- 不要伪造互动数据或不可验证的来源信息。
- 推送必须由用户自行配置。不要把 App Secret、bot token、webhook、receive_id、chat_id 或 user_id 提交到开源 skill 中。

## 版本管理

当前版本：`v0.1.0`

版本规则：

- `v0.0.x`：文案、过滤规则、评分阈值、小修复。
- `v0.x.0`：新增数据源、输出模式、字段结构或自动化流程。
- `vX.0.0`：破坏性 schema 或 workflow 变更。
