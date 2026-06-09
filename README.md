# Adgine Daily Feeds

Version: `v0.2.1`

`adgine-daily-feeds` is a Codex skill for consuming and delivering Chinese GEO/AEO daily report results. The preferred mode is API-first: the server generates the daily report JSON, and the skill keeps agent-side behavior simple.

## Current Scope

Supported in `v0.2.1`:

- API-first daily report result consumption.
- Default hosted API: `https://daily.wefnews.com/api/reports/daily/latest`.
- WeChat Official Account search via Sogou Weixin.
- GEO/AEO keyword monitoring.
- Article quality scoring.
- User-readable daily report generation.
- WeChat original URL backfill when resolved externally.
- Optional Telegram delivery with user-provided local config.

Not supported yet:

- X/Twitter, Medium, Reddit, Xiaohongshu, Douyin, GitHub, or competitor monitoring.
- Direct WeChat private API access.
- Reliable WeChat read, like, favorite, or comment metrics.
- Automatic Feishu sending as part of the skill package.
- Built-in delivery credentials, receive IDs, or fixed delivery destination.

## Structure

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
    ├── fetch-daily-report-api.mjs
    ├── generate-daily-report.mjs
    └── telegram-send.mjs
```

## Usage

Preferred API flow:

```text
GET https://daily.wefnews.com/api/reports/daily/latest
GET https://daily.wefnews.com/api/reports/daily?date=YYYY-MM-DD
```

Use the returned `report.sections` directly for display, Telegram delivery, or web feed rendering. See `references/api-report-schema.md`.

Fetch and save the latest hosted report:

```bash
node skills/adgine-daily-feeds/scripts/fetch-daily-report-api.mjs \
  --output=skills/adgine-daily-feeds/data/feed/latest-report.json
```

Local fallback flow:

Run a fresh capture and generate a daily report:

```bash
node skills/adgine-daily-feeds/scripts/generate-daily-report.mjs --end-date=2026-06-09
```

Generate a report from existing raw capture data:

```bash
node skills/adgine-daily-feeds/scripts/generate-daily-report.mjs --end-date=2026-06-09 --skip-capture
```

Apply resolved WeChat original URLs:

```bash
node skills/adgine-daily-feeds/scripts/apply-weixin-original-urls.mjs \
  --feed=skills/adgine-daily-feeds/data/feed/cio-daily-10am-window-report-2026-06-09.json \
  --resolution=skills/adgine-daily-feeds/data/raw/weixin-original-url-resolution-2026-06-09.json \
  --markdown=skills/adgine-daily-feeds/reports/daily/2026-06-09-cio-daily-10am-window-report.md
```

Check the local skill version:

```bash
node skills/adgine-daily-feeds/scripts/check-version.mjs
```

Compare against a manually supplied latest version:

```bash
node skills/adgine-daily-feeds/scripts/check-version.mjs --latest=v0.0.2
```

If the script reports `is_outdated: true`, update the skill manually before production use.

## Delivery Configuration

The skill supports optional Telegram delivery in `v0.2.1` and includes a future-ready destination config example:

```text
skills/adgine-daily-feeds/config/destinations.example.json
```

Copy it to a local ignored file before adding credentials:

```bash
cp skills/adgine-daily-feeds/config/destinations.example.json \
  skills/adgine-daily-feeds/config/destinations.local.json
```

Supported placeholders:

- `feishu`
- `telegram`

Do not commit real credentials or delivery targets. Local config files are ignored by `.gitignore`.

Discover Telegram `chat_id` after sending a message to the bot:

```bash
node skills/adgine-daily-feeds/scripts/telegram-send.mjs --list-updates
```

Send a generated report to Telegram:

```bash
node skills/adgine-daily-feeds/scripts/telegram-send.mjs \
  --post-json=skills/adgine-daily-feeds/data/feed/cio-daily-10am-window-report-2026-06-09.json \
  --log=skills/adgine-daily-feeds/data/raw/telegram-send-2026-06-09.json
```

## Output

API output should be the canonical source of truth. Local script outputs use the same report shape where possible.

Default generated outputs:

```text
skills/adgine-daily-feeds/data/raw/
skills/adgine-daily-feeds/data/feed/
skills/adgine-daily-feeds/reports/daily/
```

The user-facing report format is:

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

## Quality Rules

The skill uses an EEAT-like scoring approach:

- Experience: concrete examples, screenshots, operational detail.
- Expertise: correct GEO/AEO concepts and useful methodology.
- Authoritativeness: credible accounts, official data, reports, or citations.
- Trustworthiness: source links, clear claims, low promotional noise.

Grades:

- `must_read >= 80`
- `useful 60-79`
- `archive 45-59`
- `exclude < 45`

## Notes

- Keep the skill simple: fetch or receive daily report JSON, then display or deliver it.
- Crawling, URL resolution, scoring, deduplication, and scheduling should preferably live on the API/server side.
- Sogou Weixin may rate-limit or block requests.
- Sogou result pages usually do not expose reads, likes, comments, favorites, or collections.
- Some Sogou redirect links expire and need manual or browser-based resolution to `mp.weixin.qq.com`.
- Do not fabricate engagement metrics.
- Delivery is bring-your-own-config. Do not commit App Secret, bot token, webhook, receive_id, chat_id, or user_id into this open-source skill.
