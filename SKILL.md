---
name: adgine-daily-feeds
description: Use this skill to run the Adgine Daily Feeds workflow for Chinese GEO/AEO daily monitoring, starting with WeChat Official Account results from Sogou Weixin: capture keyword feeds, score article quality, filter low-value noise, produce a user-readable daily report, and preserve source links for Feishu or web feed display.
version: v0.2.1
---

# Adgine Daily Feeds

Version: `v0.2.1`

Use this skill when the task is to fetch, display, deliver, or fall back to generating an Adgine/CIO Daily style daily report for `GEO / AEO`.

Preferred mode is API-first: consume a server-generated daily report result. Local crawling scripts are fallback only.

## Scope

Current supported source:

- WeChat Official Accounts via Sogou Weixin search.

Default API endpoint:

- Latest report: `https://daily.wefnews.com/api/reports/daily/latest`
- Date report: `https://daily.wefnews.com/api/reports/daily?date=YYYY-MM-DD`

Not in v0.2.1:

- X/Twitter, Medium, Reddit, Xiaohongshu, Douyin, GitHub, or competitor feeds.
- Direct WeChat private API access.
- Reliable WeChat engagement metrics such as reads, likes, comments, or favorites.
- Built-in delivery destination, hardcoded bot credentials, or automatic message sending without user-configured destination.

## Core Workflow

1. Prefer the Daily Report API.
   - Read `references/api-report-schema.md` for the response shape.
   - Default to `https://daily.wefnews.com/api/reports/daily/latest` unless the user supplies a different API URL.
   - For a specific date, use `https://daily.wefnews.com/api/reports/daily?date=YYYY-MM-DD`.
   - Use the API result directly for display or delivery.

2. Establish the reporting window only when local fallback is needed.
   - Default daily slot: `10:00 Asia/Shanghai`.
   - Default window: yesterday `10:00` to today `10:00`.
   - If running before the slot, mark it as a manual/pre-open snapshot.

3. Capture WeChat/Sogou keyword results only as local fallback.
   - Default keywords: `GEO`, `AEO`, `生成式引擎优化`, `答案引擎优化`, `AI 搜索`.
   - Store raw result JSON before filtering.
   - Preserve both Sogou redirect URL and final WeChat article URL when resolved.

4. Score and filter articles.
   - Keep `must_read` and `useful` for the user-facing report.
   - Keep `archive/watch` for operations or future knowledge-base review.
   - Exclude off-topic results such as geography/GIS `GEO`, customs `AEO`, generic service ads, thin soft articles, and keyword-stuffed content.

5. Produce simple report outputs.
   - User version: concise, readable, only high-quality or scannable items.
   - Operations detail should stay in API `meta` and `warnings` unless the user asks for it.

6. Preserve source links.
   - In Feishu or web feed, put the link on the item title.
   - Avoid showing long raw URLs in the visible report body.
   - If a Sogou `/link` cannot be resolved to `mp.weixin.qq.com`, mark it unresolved instead of pretending it is final.

## Quality Standard

Prefer EEAT-like judgment:

- Experience: concrete examples, implementation detail, operational lessons.
- Expertise: technical clarity, correct GEO/AEO definitions, useful frameworks.
- Authoritativeness: credible account, named company/person, official data, reports, citations.
- Trustworthiness: source links, no exaggerated claims, no obvious hidden promotion.

Score guidance:

- `must_read >= 80`: strong method, data, official signal, case study, or market-moving update.
- `useful 60-79`: relevant and readable, with some method, signal, or reference value.
- `archive 45-59`: relevant but thin; keep for trend volume or later review.
- `exclude < 45`: noise, off-topic, soft ad, repeated template, unsupported claim.

When unsure, lower the score and explain why.

## Report Shape

For the user-facing Chinese report:

```text
CIO Daily 日报 | YYYY-MM-DD

来源：微信公众号 ｜ YYYY-MM-DD HH:mm

今日结论 ： <one concise summary sentence>
- 市场变化：...
- 策略判断：...
- 落地参考：...

今日精选
1. <linked title>
- 来源：公众号·账号名 ｜ YYYY-MM-DD HH:mm
- 指数：must_read / 81
- 推荐：一句 AI 推荐理由

延伸阅读
...

- @Adgine.ai beta
```

Rules:

- Write in Chinese by default.
- The user version should not expose query terms, raw scoring internals, or long URLs.
- Each item needs a one-sentence recommendation reason.
- If a source is blocked, unresolved, or only partially visible, say so explicitly.

## Bundled Scripts

The skill includes a minimal runnable script set under `scripts/`.

- `scripts/check-version.mjs`
  - Checks the local skill version from `VERSION` and `SKILL.md`.
  - Run this when the user asks about skill version, version check, whether the skill is outdated, or whether it needs an update.
  - Supports `--latest=vX.Y.Z` or `ADGINE_DAILY_FEEDS_LATEST_VERSION=vX.Y.Z` for manual comparison.
  - If the local version is older than the supplied latest version, tell the user to manually update the skill before production use.

- `scripts/fetch-daily-report-api.mjs`
  - Fetches the server-generated daily report JSON from `daily.wefnews.com`.
  - Defaults to `https://daily.wefnews.com/api/reports/daily/latest`.
  - Supports `--date=YYYY-MM-DD`, `--api-url=<url>`, and `--output=<path>`.
  - Use this before local crawling whenever the user wants the latest report data.

- `scripts/capture-weixin-sogou.mjs`
  - Captures Sogou Weixin keyword results.
  - Writes raw/feed/report artifacts under the skill folder when run from this skill.

- `scripts/generate-daily-report.mjs`
  - Builds the daily 10:00 window user report from captured WeChat/Sogou data.
  - Supports `--end-date=YYYY-MM-DD`.
  - Supports `--skip-capture` when raw capture data already exists.

- `scripts/apply-weixin-original-urls.mjs`
  - Applies a manually/Chrome-resolved `mp.weixin.qq.com` URL resolution JSON to a feed JSON and optional Markdown report.
  - Use this before Feishu/web publication when Sogou `/link` URLs need final WeChat article links.

- `scripts/telegram-send.mjs`
  - Sends a generated daily report JSON to Telegram using user-provided local config.
  - Uses `config/destinations.local.json:destinations.telegram` or environment variables.
  - Supports `--list-updates` to discover a usable `chat_id`.
  - Supports `--post-json=<path>`, `--chat-id=<id>`, and `--log=<path>`.

Default outputs when using bundled scripts:

- `data/raw/`
- `data/feed/`
- `reports/daily/`

## Delivery Configuration

`v0.2.1` supports optional Telegram delivery, but only with user-provided local configuration. It also reserves a generic delivery config shape for future providers.

- Example config: `config/destinations.example.json`
- Local config: `config/destinations.local.json` or `config/destinations.json`
- Local config files are ignored by `.gitignore`.

Rules:

- Do not commit real Feishu, Telegram, or other provider credentials.
- Do not hardcode delivery targets in scripts.
- Future delivery providers should be added under `destinations.<provider>`.
- Sending still requires explicit user intent or an automation that the user configured.

## Repository Hints

When working inside `cio-daily`, prefer existing project scripts before inventing new ones:

- `scripts/capture-weixin-sogou.mjs`
- `scripts/generate-10am-window-report.mjs`
- `scripts/apply-weixin-original-urls.mjs`
- `scripts/run-10am-window-report.mjs`
- `scripts/feishu-send.mjs`

Reference files:

- Read `references/api-report-schema.md` before designing or consuming the API layer.
- Read `references/weixin-sogou.md` for source handling and known limitations.
- Read `references/report-format.md` before changing user-facing report structure.
- Read `references/versioning.md` before bumping the skill version.

## Version Check Trigger

When the user asks any of the following, run `scripts/check-version.mjs` before answering:

- "当前 skill 是什么版本"
- "检查 skill 版本"
- "这个 skill 是否过期"
- "需要更新 skill 吗"
- "adgine-daily-feeds 版本检测"

If there is no remote/latest version supplied, report the local version and consistency only. If the user or release note supplies a latest version, compare against it with `--latest=vX.Y.Z`.

## Safety

- Do not use private WeChat APIs or personal account actions unless explicitly authorized.
- Do not fabricate read/like/comment/favorite counts; Sogou result pages usually do not expose them.
- Do not send Feishu messages unless the user asks for sending or the automation run specifically requires it.
- Do not hardcode Feishu App ID, App Secret, Telegram bot token, webhook, receive_id, chat_id, or user_id into the skill. Delivery must be configured by the user outside committed source.
- Keep X/Twitter collection read-only if future versions add it: no posting, liking, following, DMs, or settings changes.
