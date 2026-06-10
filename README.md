# Adgine Daily Feeds

Version: `v0.6.0`

`adgine-daily-feeds` is a Codex skill for consuming and delivering Chinese GEO/AEO daily report results. It is API-only: the server generates the daily report JSON, and the skill fetches or delivers that result.

## Supported

- Default hosted API: `https://daily.wefnews.com/api/reports/daily/latest`.
- Date-specific API: `https://daily.wefnews.com/api/reports/daily?date=YYYY-MM-DD`.
- User-readable daily report display.
- Standalone temporary HTML report rendering with Light/Dark theme switch.
- Platform-aware HTML cards for API-provided WeChat, X, and Medium sections.
- Optional Telegram delivery with user-provided local config.
- Local version checking.

## Not Supported

- Local Sogou Weixin crawling.
- Browser-based WeChat original URL resolution.
- Direct WeChat private API access.
- Built-in delivery credentials or fixed delivery destinations.

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

Use the returned `report.sections` directly for display, Telegram delivery, or web feed rendering. See `references/api-report-schema.md`.

When the API includes supplemental `X 观察` or `Medium 观察` sections, keep them in `report.sections`. The HTML renderer reads `source.platform` / `source_platform`, `summary`, `tags`, and `metrics` automatically.

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

## Version Check

```bash
node skills/adgine-daily-feeds/scripts/check-version.mjs
```

Compare against a manually supplied latest version:

```bash
node skills/adgine-daily-feeds/scripts/check-version.mjs --latest=v0.6.0
```

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
