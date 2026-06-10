---
name: adgine-daily-feeds
description: Use this skill to fetch, display, summarize, render HTML, or deliver Adgine/CIO Daily Chinese GEO/AEO daily report results from the hosted daily.wefnews.com API, with optional Telegram delivery using user-provided configuration.
version: v0.6.0
---

# Adgine Daily Feeds

Version: `v0.6.0`

Use this skill when the task is to fetch, display, summarize, render HTML, or deliver an Adgine/CIO Daily style daily report for `GEO / AEO`.

This skill is API-only. It consumes a server-generated daily report result and does not crawl Sogou Weixin locally.

## Scope

Current supported sources:

- Server-generated WeChat/Sogou daily report from `daily.wefnews.com`.
- API-provided supplemental X and Medium sections when present in `report.sections`.

Default API endpoint:

- Latest report: `https://daily.wefnews.com/api/reports/daily/latest`
- Date report: `https://daily.wefnews.com/api/reports/daily?date=YYYY-MM-DD`

Not in v0.6.0:

- Local X/Twitter, Medium, Reddit, Xiaohongshu, Douyin, GitHub, or competitor crawling.
- Local Sogou Weixin crawling or browser-based WeChat URL resolution.
- Direct WeChat private API access.
- Reliable WeChat engagement metrics such as reads, likes, comments, or favorites.
- Built-in delivery destination, hardcoded bot credentials, or automatic message sending without user-configured destination.

## Core Workflow

1. Fetch the Daily Report API.
   - Read `references/api-report-schema.md` for the response shape.
   - Default to `https://daily.wefnews.com/api/reports/daily/latest` unless the user supplies a different API URL.
   - For a specific date, use `https://daily.wefnews.com/api/reports/daily?date=YYYY-MM-DD`.
   - Use the API result directly for display or delivery.

2. Produce simple report outputs.
   - User version: concise, readable, only high-quality or scannable items.
   - For a temporary HTML page, run `scripts/render-daily-report-html.mjs`.
   - HTML output defaults to light theme and includes a Light/Dark switch.
   - HTML cards parse `source.platform`, `source_platform`, `summary`, `tags`, and `metrics` for WeChat, X, Medium, and future sources.
   - Operations detail should stay in API `meta` and `warnings` unless the user asks for it.

3. Preserve source links from the API.
   - In Feishu or web feed, put the link on the item title.
   - Avoid showing long raw URLs in the visible report body.
   - If an API item only has a temporary or fallback link, report that state instead of pretending it is permanent.

## Quality Standard

The hosted API owns scoring and filtering. When explaining or reviewing report items, use EEAT-like language:

- Experience: concrete examples, implementation detail, operational lessons.
- Expertise: technical clarity, correct GEO/AEO definitions, useful frameworks.
- Authoritativeness: credible account, named company/person, official data, reports, citations.
- Trustworthiness: source links, no exaggerated claims, no obvious hidden promotion.

Do not rescore items unless the user explicitly asks for analysis. Prefer the API-provided quality fields.

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
  - Use this whenever the user wants the latest report data.

- `scripts/render-daily-report-html.mjs`
  - Fetches the hosted API or reads a saved API JSON, then renders a standalone HTML page.
  - Defaults to the same hosted latest-report API.
  - Supports `--date=YYYY-MM-DD`, `--api-url=<url>`, `--input=<path>`, `--output=<path>`, and `--theme=light|dark`.
  - Default theme is `light`; the generated page also includes an in-page Light/Dark switch.
  - Renders platform badges and optional summaries/tags/metrics for `weixin`, `x`, and `medium` items.
  - Uses `templates/daily-report.html`.
  - Use this when WorkBuddy or another agent needs a temporary readable HTML page without building a web app.

- `scripts/telegram-send.mjs`
  - Sends a generated daily report JSON to Telegram using user-provided local config.
  - Uses `config/destinations.local.json:destinations.telegram` or environment variables.
  - Supports `--list-updates` to discover a usable `chat_id`.
  - Supports `--post-json=<path>`, `--chat-id=<id>`, and `--log=<path>`.

Default output when saving API results:

- `data/feed/`

## Delivery Configuration

`v0.6.0` supports optional Telegram delivery, but only with user-provided local configuration. It also reserves a generic delivery config shape for future providers.

- Example config: `config/destinations.example.json`
- Local config: `config/destinations.local.json` or `config/destinations.json`
- Local config files are ignored by `.gitignore`.

Rules:

- Do not commit real Feishu, Telegram, or other provider credentials.
- Do not hardcode delivery targets in scripts.
- Future delivery providers should be added under `destinations.<provider>`.
- Sending still requires explicit user intent or an automation that the user configured.

## Repository Hints

When working inside `cio-daily`, this skill should still consume the hosted API unless the user explicitly asks to modify the production app.

Reference files:

- Read `references/api-report-schema.md` before designing or consuming the API layer.
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
- Do not crawl X or Medium locally from the skill; consume API-provided sections unless the user explicitly asks for a separate capture workflow.
- Do not fabricate read/like/comment/favorite counts; Sogou result pages usually do not expose them.
- Do not send Feishu messages unless the user asks for sending or the automation run specifically requires it.
- Do not hardcode Feishu App ID, App Secret, Telegram bot token, webhook, receive_id, chat_id, or user_id into the skill. Delivery must be configured by the user outside committed source.
- Keep X/Twitter collection read-only if future versions add it: no posting, liking, following, DMs, or settings changes.
