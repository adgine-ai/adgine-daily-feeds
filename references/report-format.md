# Report Format

Version: `v0.2.0`

## User Version

The user-facing report should optimize for scanning and clicking:

- Title: `CIO Daily 日报 | YYYY-MM-DD`
- Scope line: `来源：微信公众号 ｜ YYYY-MM-DD HH:mm`
- Conclusion: one summary sentence plus three short bullets.
- Items: linked title, compact source/time line, score line, recommendation line.
- Footer: `- @Adgine.ai beta`

Do not show:

- Raw long URLs.
- Search query terms.
- Full scoring internals.
- Low-quality noise lists.
- Operational tuning notes.

## Operations Version

The operations version may include:

- Query list and source volume.
- `sampled_count`, `window_count`, selected count, excluded count.
- Noise categories and examples.
- Scoring distribution.
- URL resolution failures.
- Suggested keyword/filter/scoring changes.

## Item Fields

Recommended normalized item fields:

```json
{
  "title": "Article title",
  "source": "公众号·Account",
  "published_label": "YYYY-MM-DD HH:mm｜useful / 73",
  "url": "https://weixin.sogou.com/link?...",
  "href_url": "https://mp.weixin.qq.com/...",
  "query": "GEO",
  "quality_reason": "Internal scoring reason",
  "ai_recommendation": "One user-facing recommendation sentence"
}
```

Use `href_url` for user-facing links when available.

## Bundled Script Usage

Generate a report for a target end date:

```bash
node skills/adgine-daily-feeds/scripts/generate-daily-report.mjs --end-date=2026-06-09
```

Generate from an existing raw capture without fetching again:

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
