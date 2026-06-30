# Adgine Daily Feeds

Version: `v0.6.10`

`adgine-daily-feeds` is a Codex skill for consuming and delivering Chinese GEO/AEO feed, daily report, and weekly report results. It is API-only: the server generates the JSON, and the skill fetches, renders, or delivers that result.

## Agent Entry Model

This version frames the skill as an Agent entrypoint, not only a script wrapper:

- Broad "latest GEO/AEO" questions default to the live feed.
- Explicit daily-report requests use daily report endpoints.
- Explicit weekly-review requests use weekly report endpoints.
- Explicit WeChat/X/Twitter/Medium requests use feed source filters when available.
- Explicit time-window requests use feed `start_at` / `end_at` parameters.
- HTML or preview requests render standalone HTML.
- Missing data must be reported as "not returned by the current API", not inferred as absent from the platform.

Current integration surface: Skill, hosted REST JSON API, local standalone HTML preview, and optional user-configured Telegram delivery.

Roadmap, not current capability: public `/agent` page, hosted installer, RSS, OpenAPI, server-side `q` search, and richer topic filters.

## Supported

- Default hosted API: `https://daily.wefnews.com/api/reports/daily/latest`.
- Date-specific API: `https://daily.wefnews.com/api/reports/daily?date=YYYY-MM-DD`.
- Real-time feed API: `https://daily.wefnews.com/api/feed`.
- Weekly report API: `https://daily.wefnews.com/api/reports/weekly/latest`.
- User-readable daily report display.
- User-readable weekly report display.
- Standalone temporary HTML report rendering with Light/Dark theme switch.
- Platform-aware HTML cards for API-provided WeChat, X, and Medium sections.
- `latest` report naming based on the Asia/Shanghai window end date, for example `Adgine Daily 日报 | 2026-06-10`.
- Multi-source totals such as `x_count` and `medium_count` when the API includes those sections.
- Optional Telegram delivery with user-provided local config.
- Local version checking.
- Agent intent routing for feed, daily, weekly, source, time-window, and HTML requests.

## Not Supported

- Local Sogou Weixin crawling.
- Browser-based WeChat original URL resolution.
- Direct WeChat private API access.
- Built-in delivery credentials or fixed delivery destinations.
- Public RSS, OpenAPI, hosted installer, or server-side keyword search.

## Structure

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

## API Usage

Fetch the latest hosted report:

```bash
node skills/adgine-daily-feeds/scripts/fetch-daily-report-api.mjs --report
```

Fetch the default real-time feed:

```bash
node skills/adgine-daily-feeds/scripts/fetch-daily-report-api.mjs
```

Fetch a specific date:

```bash
node skills/adgine-daily-feeds/scripts/fetch-daily-report-api.mjs --date=2026-06-09
```

Save the hosted report locally:

```bash
node skills/adgine-daily-feeds/scripts/fetch-daily-report-api.mjs \
  --output=skills/adgine-daily-feeds/data/feed/latest-report.json
```

Fetch the latest weekly report:

```bash
node skills/adgine-daily-feeds/scripts/fetch-daily-report-api.mjs --weekly
```

Fetch a weekly range:

```bash
node skills/adgine-daily-feeds/scripts/fetch-daily-report-api.mjs \
  --weekly \
  --start-date=2026-06-08 \
  --end-date=2026-06-12
```

Fetch a source/time-window filtered feed:

```bash
node skills/adgine-daily-feeds/scripts/fetch-daily-report-api.mjs \
  --source=x \
  --start-at="2026-06-25 10:00" \
  --end-at="2026-06-26 09:42" \
  --limit=50
```

Use the returned `report.sections` directly for display, Telegram delivery, or web feed rendering. See `references/api-report-schema.md`.

When the API includes supplemental `X 观察` or `Medium 观察` sections, keep them in `report.sections`. The HTML renderer reads `source.platform` / `source_platform`, `summary`, `tags`, and `metrics` automatically.

Notes:

- `latest` means the most recent generated window-end report currently available from the hosted API. It can temporarily lag behind the wall-clock day when deployment or publication is delayed.
- `report.title` and top-level `date` are report dates, not per-item publish dates.
- Do not infer X or Medium sections from previous dates. Use only the sections returned by the current API response.

## HTML Template

Render the latest hosted report to a standalone HTML file:

```bash
node skills/adgine-daily-feeds/scripts/render-daily-report-html.mjs \
  --output=skills/adgine-daily-feeds/data/html/latest-report.html
```

Default theme is light. The generated HTML also includes a Light/Dark switch. To open in dark mode first:

```bash
node skills/adgine-daily-feeds/scripts/render-daily-report-html.mjs \
  --theme=dark \
  --output=skills/adgine-daily-feeds/data/html/latest-report.html
```

Render a specific date:

```bash
node skills/adgine-daily-feeds/scripts/render-daily-report-html.mjs \
  --date=2026-06-09 \
  --output=skills/adgine-daily-feeds/data/html/2026-06-09.html
```

Render from a saved API result:

```bash
node skills/adgine-daily-feeds/scripts/render-daily-report-html.mjs \
  --input=skills/adgine-daily-feeds/data/feed/latest-report.json \
  --output=skills/adgine-daily-feeds/data/html/latest-report.html
```

Render a weekly report:

```bash
node skills/adgine-daily-feeds/scripts/render-daily-report-html.mjs \
  --weekly \
  --output=skills/adgine-daily-feeds/data/html/latest-weekly.html
```

## Version Check

```bash
node skills/adgine-daily-feeds/scripts/check-version.mjs
```

By default this checks the GitHub `main` branch `VERSION` file. Compare against a manually supplied latest version:

```bash
node skills/adgine-daily-feeds/scripts/check-version.mjs --latest=v0.6.10
```

Disable the remote check and only verify local files:

```bash
node skills/adgine-daily-feeds/scripts/check-version.mjs --no-remote
```

When `--latest` is newer than the local version, the script includes a lark-cli-style update notice:

```json
{
  "_notice": {
    "update": {
      "command": "git pull",
      "current": "v0.6.10",
      "latest": "v0.6.11",
      "message": "adgine-daily-feeds v0.6.11 available, current v0.6.10, run: git pull"
    }
  }
}
```

Version policy: keep normal releases in the current GitHub minor lane and only bump the last number. Do not bump to a new minor or major version unless the user explicitly approves that transition.

## Delivery Configuration

The skill supports optional Telegram delivery and includes a future-ready destination config example:

```text
skills/adgine-daily-feeds/config/destinations.example.json
```

Copy it to a local ignored file before adding credentials:

```bash
cp skills/adgine-daily-feeds/config/destinations.example.json \
  skills/adgine-daily-feeds/config/destinations.local.json
```

Do not commit real credentials or delivery targets.

Send a saved report to Telegram:

```bash
node skills/adgine-daily-feeds/scripts/telegram-send.mjs \
  --post-json=skills/adgine-daily-feeds/data/feed/latest-report.json \
  --log=skills/adgine-daily-feeds/data/feed/telegram-send-latest.json
```
