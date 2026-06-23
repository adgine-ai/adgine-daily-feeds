---
name: adgine-daily-feeds
description: Use this skill to fetch, display, summarize, render HTML, or deliver Adgine/CIO Daily Chinese GEO/AEO feed, daily report, and weekly report results from the hosted daily.wefnews.com API, with optional Telegram delivery using user-provided configuration.
version: v0.6.5
---

# Adgine Daily Feeds

Version: `v0.6.5`

Use this skill when the task is to fetch, display, summarize, render HTML, or deliver an Adgine/CIO Daily style feed, daily report, or weekly report for `GEO / AEO`.

This skill is API-only. It consumes server-generated feed and daily report results and does not crawl Sogou Weixin locally.

## Scope

Current supported sources:

- Server-generated WeChat/Sogou feed, daily report, and weekly report from `daily.wefnews.com`.
- API-provided supplemental `X 观察` and `Medium 观察` sections when present in `report.sections`.

Default API endpoints:

- Feed stream: `https://daily.wefnews.com/api/feed`
- Latest report: `https://daily.wefnews.com/api/reports/daily/latest`
- Date report: `https://daily.wefnews.com/api/reports/daily?date=YYYY-MM-DD&slot=10am|18pm|22pm|latest`
- Latest weekly report: `https://daily.wefnews.com/api/reports/weekly/latest`
- Weekly range report: `https://daily.wefnews.com/api/reports/weekly?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`

Default behavior:

- Use the feed endpoint by default because it is the real-time/incremental view.
- Use the daily report endpoint only when the user asks for a fixed daily report, report snapshot, or specific date/slot report.
- Use the weekly report endpoint only when the user asks for a weekly review, weekly summary, or weekly HTML.

Report slot semantics:

- The production app can generate multiple report windows per day.
- Current known slots are `10am`, `18pm`, and planned `22pm`.
- `latest` means the newest generated report available on the hosted API; when an `18pm` report exists for a date it may be newer than that date's `10am` report.
- `report.window.slot` and top-level `slot`, when present, identify the report window. Do not infer slot from wall-clock time.

Date and window UX:

- When answering a daily report request, state the actual report date and slot/window when the API exposes them.
- If the user asks for "今天" or "今日", compare the API report date with the current Asia/Shanghai date. If `latest` is older than today, say that the latest available report is older and name the exact date.
- When a user asks for historical reports without a date, ask for a date in `YYYY-MM-DD` format or offer to fetch the latest report first.
- For feed responses, describe the feed window in user language such as "上一日 10:00 到当前时间" when available.

Not in v0.6.5:

- Local X/Twitter, Medium, Reddit, Xiaohongshu, Douyin, GitHub, or competitor crawling.
- Local Sogou Weixin crawling or browser-based WeChat URL resolution.
- Direct WeChat private API access.
- Reliable WeChat engagement metrics such as reads, likes, comments, or favorites.
- Built-in delivery destination, hardcoded bot credentials, or automatic message sending without user-configured destination.

## Core Workflow

1. Fetch the API.
   - Read `references/api-report-schema.md` for the response shape.
   - Default to `https://daily.wefnews.com/api/feed` unless the user supplies a different API URL.
   - For the fixed latest report snapshot, use `https://daily.wefnews.com/api/reports/daily/latest`.
   - For a specific date, use `https://daily.wefnews.com/api/reports/daily?date=YYYY-MM-DD`.
   - Use the API result directly for display or delivery.
   - Treat `report.title` / top-level `date` as the report end date in `Asia/Shanghai`, not as the publication date of every item.
   - Treat `slot` / `report.window.slot` as the report window identity.

2. Produce simple report outputs.
   - User version: concise, readable, only high-quality or scannable items.
   - For a temporary HTML page, run `scripts/render-daily-report-html.mjs`.
   - HTML output defaults to light theme and includes a single icon theme toggle.
   - The HTML renderer supports both daily report JSON and weekly report JSON.
   - The daily HTML template uses a compact daily.wefnews-style layout with source/time metadata on one line, tag-forward summaries, and score badges pinned to the card corner.
   - HTML cards parse `source.platform`, `source_platform`, `summary`, `tags`, and `metrics` for WeChat, X, Medium, and future sources.
   - When `display_scope` is `来源：微信公众号 / X / Medium`, preserve the multi-source structure instead of flattening all items into one generic list.
   - For feed stream output, preserve item-level `href`, `slot`, `captured_display`, `published_display`, and `section_title`.
   - Operations detail should stay in API `meta` and `warnings` unless the user asks for it.
   - When saving JSON or rendering HTML, include the output path, source API or input file, report date, and slot/window in the final answer.
   - Treat standalone HTML preview as a first-class output option. If the user asks to "看效果", "预览", "生成页面", or "HTML", render a temporary HTML file and return its path.

3. Preserve source links from the API.
   - In Feishu or web feed, put the link on the item title.
   - Avoid showing long raw URLs in the visible report body.
- If an API item only has a temporary or fallback link, report that state instead of pretending it is permanent.
- For WeChat items, prefer `href_url` / `href` when it starts with `https://mp.weixin.qq.com/`; do not expose Sogou redirect links as if they are original article links.

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
- Do not show the visible count summary line such as `今日精选 3 条 ｜ 延伸阅读 3 条 ｜ X 观察 2 条 ｜ Medium 观察 2 条`.
- Keep `今日结论` short and dynamic. Avoid repeating the same `阅读顺序` / `行动建议` boilerplate every day.
- Each item needs a one-sentence recommendation reason.
- Item titles should carry links. Avoid raw long URLs in the visible body.
- The visible item index line should keep `指数` compact. In Feishu card output, use icons to make the unified grade stand out: `🔥 must_read / 83`, `🔵 useful / 73`, `🟣 watch / 75`.
- If a source is blocked, unresolved, or only partially visible, say so explicitly.
- Do not assume X / Medium are always present for every date. Missing sections can mean the hosted report did not include supplement data for that window.

Error and empty-state rules:

- If an API request fails, answer with `数据状态`, `可能原因`, and `下一步建议`.
- If the API returns no items for a requested date or slot, do not fabricate a report. Say which date/slot was requested and suggest trying `latest` or another date.
- If supplemental sections such as X or Medium are missing, frame it as current API data absence unless the API explicitly reports a failure.
- If a generated file path points to a temporary directory, say it is a temporary preview artifact.

Output metadata:

- After generating or saving artifacts, include a compact metadata block when useful:

```text
产物：
- JSON：<path or 未保存>
- HTML：<path or 未生成>
- 来源：<API URL or input file>
- 报告：YYYY-MM-DD / slot
```

## Follow-up Shortcuts

After answering a feed, daily report, weekly report, or skill-version request, append a short `快捷入口` block unless the user explicitly asks for no follow-up suggestions.

Keep the shortcuts concise and action-oriented. Prefer 2-4 items, using Chinese labels that the user can send directly as the next request:

```text
快捷入口：
- 查看今日 GEO 日报
- 查看最新 GEO 信息流
- 查看往常日报
- 生成 HTML 预览
- 生成本周 GEO 周报
```

Rules:

- Match shortcuts to the current context. For a daily report, include "查看今日 GEO 日报" and "查看往常日报"; for a feed response, include "查看最新 GEO 信息流"; for a weekly response, include "生成本周 GEO 周报".
- Include "生成 HTML 预览" when the response produced a text report but not an HTML file.
- If the user asks "查看往常日报" without a date, ask for a date or offer the format `查看 2026-06-22 GEO 日报`.
- Do not include raw API URLs in the shortcut labels.
- Do not over-explain the shortcuts. They are next-action prompts, not documentation.
- If the answer already ends with an explicit next step requested by the user, keep the shortcut block after that step.

For the user-facing Chinese weekly report:

```text
CIO Daily 周报 | YYYY-MM-DD - YYYY-MM-DD

本周结论
- ...

一周数据概览
- 精选内容、原始公众号样本、来源分布、质量分布。

主题趋势
- 主题名 / 数量 / 变化解释。

本周优先阅读
1. <linked title>
- 来源：平台·账号 ｜ YYYY-MM-DD HH:mm
- 指数：🔥 must_read / 85
- 推荐：一句 AI 推荐理由

- @Adgine.ai beta
```

Weekly report rules:

- Weekly reports summarize already generated feed/daily data. Do not trigger new crawling from the skill.
- Prefer the hosted weekly API or a saved weekly JSON file.
- If the user asks for PDF, render HTML first and treat PDF export as a downstream conversion step.

## Bundled Scripts

The skill includes a minimal runnable script set under `scripts/`.

- `scripts/check-version.mjs`
  - Checks the local skill version from `VERSION` and `SKILL.md`.
  - Run this when the user asks about skill version, version check, whether the skill is outdated, or whether it needs an update.
  - Supports `--latest=vX.Y.Z` or `ADGINE_DAILY_FEEDS_LATEST_VERSION=vX.Y.Z` for manual comparison.
  - If the local version is older than the supplied latest version, tell the user to manually update the skill before production use.
  - For production validation, prefer cloning or downloading the GitHub repository into a temporary directory and running the check there. Do not update WorkBuddy's local skill cache unless the user explicitly asks.

- `scripts/fetch-daily-report-api.mjs`
  - Fetches the server-generated feed or daily report JSON from `daily.wefnews.com`.
  - Defaults to `https://daily.wefnews.com/api/feed`.
  - Supports `--report`, `--weekly`, `--date=YYYY-MM-DD`, `--slot=10am|18pm|22pm`, `--start-date=YYYY-MM-DD`, `--end-date=YYYY-MM-DD`, `--start-at="YYYY-MM-DD HH:mm"`, `--end-at="YYYY-MM-DD HH:mm"`, `--source=all|weixin_mp|x|medium`, `--limit=N`, `--api-url=<url>`, and `--output=<path>`.
  - Use the default feed mode whenever the user wants current feed data.
  - Use `--report` when the user wants a fixed daily report snapshot.
  - Use `--weekly` when the user wants a weekly report snapshot.
  - Remember that `latest` means the latest generated window-end report available on the hosted API, not necessarily the current wall-clock day if deployment or data publication is lagging.
  - Feed mode defaults to the natural rolling window from previous-day `10:00` Asia/Shanghai to current wall-clock time. For example, at `2026-06-11 09:42`, the request window is `2026-06-10 10:00` to `2026-06-11 09:42`.

- `scripts/render-daily-report-html.mjs`
  - Fetches the hosted API or reads a saved API JSON, then renders a standalone HTML page.
  - Defaults to the same hosted latest-report API.
  - Supports `--weekly`, `--date=YYYY-MM-DD`, `--slot=10am|18pm`, `--start-date=YYYY-MM-DD`, `--end-date=YYYY-MM-DD`, `--api-url=<url>`, `--input=<path>`, `--output=<path>`, and `--theme=light|dark`.
  - Default theme is `light`; the generated page also includes an in-page Light/Dark switch.
  - Renders platform badges and optional summaries/tags/metrics for `weixin`, `x`, and `medium` items.
  - Renders weekly report JSON with `本周结论`, `主题趋势`, and `本周优先阅读`.
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

`v0.6.5` supports optional Telegram delivery, but only with user-provided local configuration. It also reserves a generic delivery config shape for future providers.

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

If the user is debugging why `daily.wefnews.com` shows an older title date such as `CIO Daily 日报 | 2026-06-09` while a newer local report exists, first verify the hosted API output. The likely cause is deployment/data lag, not the HTML template hardcoding the date.

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
- Do not infer missing X / Medium sections from prior dates. Use only what the hosted API actually returns for the requested date.
- Do not fabricate read/like/comment/favorite counts; Sogou result pages usually do not expose them.
- Do not send Feishu messages unless the user asks for sending or the automation run specifically requires it.
- Do not hardcode Feishu App ID, App Secret, Telegram bot token, webhook, receive_id, chat_id, or user_id into the skill. Delivery must be configured by the user outside committed source.
- Keep X/Twitter collection read-only if future versions add it: no posting, liking, following, DMs, or settings changes.
