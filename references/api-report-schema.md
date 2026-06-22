# Daily Report API Schema

Version: `v0.6.3`

The API layer returns generated feed, daily report, and weekly report results. Crawling, browser-based WeChat URL resolution, scoring, deduplication, and scheduling happen on the server side before this API is consumed.

## Principle

Keep the skill simple:

- Fetch the hosted feed JSON by default.
- Fetch a generated daily report JSON only when the user asks for a fixed report snapshot or a specific date.
- Fetch a generated weekly report JSON only when the user asks for weekly review.
- Display, summarize, or deliver the API result to a configured channel.
- Do not make every agent crawl Sogou Weixin or resolve WeChat links.
- If the API is unavailable, report the missing state. This skill no longer includes local crawling fallback.

## Endpoint

Default hosted endpoint:

```http
GET https://daily.wefnews.com/api/reports/daily/latest
GET https://daily.wefnews.com/api/reports/daily?date=YYYY-MM-DD&slot=10am|18pm|22pm|latest
GET https://daily.wefnews.com/api/feed
GET https://daily.wefnews.com/api/reports/weekly/latest
GET https://daily.wefnews.com/api/reports/weekly?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
```

The current hosted response is:

```json
{
  "ok": true,
  "date": "2026-06-10",
  "report": {}
}
```

Use `report.sections` directly. If `ok` is not `true`, treat the report as unavailable and do not fabricate content.

Important date and slot semantics:

- `date` is the report date for the Asia/Shanghai report window end.
- `slot` or `report.window.slot`, when present, identifies the report window. Current values are `10am` and `18pm`.
- `latest` means the newest generated report currently available from the hosted API. If an `18pm` report exists, it may be newer than the same date's `10am` report.
- `report.title` should match that report date, for example `CIO Daily 日报 | 2026-06-10`.
- Individual items inside `report.sections` can have `published_at` earlier than `date`, because they are selected from the prior 24-hour window.

Future normalized endpoint:

```http
GET /v1/reports/daily?date=YYYY-MM-DD&source=weixin_sogou
```

Default parameters:

- `date`: report end date in `Asia/Shanghai`.
- `source`: default `weixin_sogou`.
- `format`: optional, default `json`.

## Response

### Daily Report

```json
{
  "api_version": "v1",
  "status": "ready",
  "report_id": "cio_daily_2026_06_10_weixin_sogou_10am",
  "date": "2026-06-10",
  "slot": "10am",
  "timezone": "Asia/Shanghai",
  "source": {
    "id": "weixin_sogou",
    "label": "微信公众号",
    "raw_provider": "sogou_weixin"
  },
  "window": {
    "start_at": "2026-06-09T10:00:00+08:00",
    "end_at": "2026-06-10T10:00:00+08:00",
    "slot": "10am",
    "end_hour": 10
  },
  "generated_at": "2026-06-10T10:28:00+08:00",
  "report": {
    "title": "CIO Daily 日报 | 2026-06-10",
    "render_style": "user_daily",
    "display_scope": "来源：微信公众号 / X / Medium",
    "display_captured_at": "2026-06-10 10:00",
    "sections": [
      {
        "id": "conclusion",
        "title": "今日结论",
        "items": [
          {
            "id": "conclusion_001",
            "title": "过去 24 小时 GEO/AEO 信息量不低，但值得优先阅读的是 10 条高质量内容。",
            "bullets": [
              "内容结构：本轮精选 0 条 must_read、10 条 useful，优先覆盖行业动态、方法论、风险边界和数据监测。",
              "阅读顺序：先看今日精选掌握关键变化，再看延伸阅读补齐方法和案例。",
              "行动建议：品牌/内容团队应重点检查 AI 搜索曝光、内容证据链和合规边界。"
            ]
          }
        ]
      },
      {
        "id": "top_items",
        "title": "今日精选",
        "items": []
      },
      {
        "id": "further_reading",
        "title": "延伸阅读",
        "items": []
      },
      {
        "id": "x_observation",
        "title": "X 观察",
        "items": []
      },
      {
        "id": "medium_observation",
        "title": "Medium 观察",
        "items": []
      }
    ],
    "footer": "- @Adgine.ai beta"
  },
  "items": [],
  "meta": {
    "sampled_count": 364,
    "window_count": 61,
    "selected_count": 16,
    "source_count": 3,
    "x_count": 2,
    "medium_count": 4,
    "resolved_url_count": 10,
    "unresolved_url_count": 0,
    "quality_distribution": {
      "must_read": 0,
      "useful": 10,
      "archive": 18,
      "exclude": 39
    }
  },
  "warnings": []
}
```

## Item Schema

Each displayed article item should use this shape:

```json
{
  "id": "wx_20260609_001",
  "title": "GEO 的底层逻辑是什么？",
  "source": {
    "platform": "weixin_mp",
    "label": "公众号·账号名",
    "account_name": "账号名"
  },
  "published_at": "2026-06-08T22:56:00+08:00",
  "published_label": "2026-06-08 22:56｜useful / 73",
  "url": "https://mp.weixin.qq.com/...",
  "href_url": "https://mp.weixin.qq.com/...",
  "fallback_url": "https://weixin.sogou.com/link?...",
  "url_status": "resolved",
  "quality": {
    "grade": "useful",
    "score": 73,
    "reason": "主题相关且有方法/市场信号，适合进入可扫列表。"
  },
  "ai_recommendation": "适合作为实操参考，观察别人如何把 GEO 方法落到具体项目。"
}
```

Supplemental X or Medium items can use the same item shape:

```json
{
  "title": "Why Your Brand Isn’t Showing Up in ChatGPT",
  "source": {
    "platform": "medium",
    "label": "Medium·Author",
    "account_name": "Author"
  },
  "source_platform": "medium",
  "published_at": "2026-06-09T10:25:59Z",
  "published_label": "2026-06-09 18:25｜useful / 76",
  "url": "https://medium.com/...",
  "summary": "One short source summary.",
  "tags": ["Medium", "ai-search", "geo"],
  "metrics": {
    "rss_tag": "ai-search"
  },
  "ai_recommendation": "One sentence explaining why this item is useful."
}
```

Top-level `report.totals` may also include optional multi-source counters when the hosted report contains supplement sections:

```json
{
  "sampled_count": 364,
  "window_count": 61,
  "selected_count": 16,
  "source_count": 3,
  "x_count": 2,
  "medium_count": 4
}
```

Supported `source.platform` values for HTML rendering:

- `weixin` / `weixin_mp`
- `x` / `twitter`
- `medium`
- other strings fall back to a neutral source badge.

## Weekly Report Endpoint

Use the weekly endpoint when the user asks for a weekly review, weekly summary, or weekly HTML. Weekly reports summarize already generated feed and daily data. The skill should not crawl new data for this step.

```http
GET https://daily.wefnews.com/api/reports/weekly/latest
GET https://daily.wefnews.com/api/reports/weekly?start_date=2026-06-08&end_date=2026-06-12
```

Typical hosted wrapper:

```json
{
  "ok": true,
  "start_date": "2026-06-08",
  "end_date": "2026-06-12",
  "weekly_report": {}
}
```

The `weekly_report` object can also be saved directly:

```json
{
  "title": "CIO Daily 周报 | 2026-06-08 - 2026-06-12",
  "generated_at": "2026-06-12T10:30:00+08:00",
  "range": {
    "start": "2026-06-08",
    "end": "2026-06-12",
    "timezone": "Asia/Shanghai",
    "requested_days": 5
  },
  "summary": {
    "available_dates": ["2026-06-08", "2026-06-09"],
    "missing_dates": [],
    "totals": {
      "selected_unique_items": 48,
      "raw_weixin_unique_items": 1141,
      "days_with_daily_report": 5,
      "days_with_raw_weixin": 5
    },
    "by_source": {
      "weixin_mp": 33,
      "x": 8,
      "medium": 7
    },
    "by_quality": {
      "must_read": 13,
      "useful": 30,
      "watch": 5
    },
    "by_day": {},
    "high_quality_by_day": {},
    "topics": [
      {
        "topic": "AI Search / SEO 关系",
        "count": 19
      }
    ],
    "top_items": [
      {
        "title": "Article title",
        "source": "X·@account",
        "platform": "x",
        "published_at": "2026-06-10 11:34",
        "quality": {
          "grade": "must_read",
          "score": 85
        },
        "url": "https://x.com/...",
        "recommendation": "一句 AI 推荐理由。",
        "section": "X 观察"
      }
    ]
  },
  "conclusion": [
    "本周可读内容共 48 条，其中 must_read 13 条、useful 30 条。",
    "主题重心集中在 AI Search / SEO 关系。",
    "微信公众号贡献 33 条，X/Medium 贡献 15 条。"
  ]
}
```

Weekly rendering rules:

- `title` is the visible report title.
- `range.start` and `range.end` are the report date range in `Asia/Shanghai`.
- `summary.top_items` is the priority reading list. Keep links on titles.
- `summary.topics` is the topic trend block.
- `conclusion` should be shown as a short weekly conclusion, not expanded into a long operations memo.

## Feed Stream Endpoint

Use the feed endpoint by default. It is the real-time/incremental view for agents and skills. Use it when the user asks to browse all data, build an unread/new-item view, inspect historical items across reports, or simply asks for the latest feed data:

```http
GET https://daily.wefnews.com/api/feed
```

Default feed window:

- The endpoint defaults to the natural rolling window from previous-day `10:00` Asia/Shanghai to current wall-clock time.
- Example: at `2026-06-11 09:42`, the default window is `2026-06-10 10:00` through `2026-06-11 09:42`.
- Override with query params:

```http
GET https://daily.wefnews.com/api/feed?start_at=2026-06-10%2010%3A00&end_at=2026-06-11%2009%3A42&source=all&limit=50
```

Supported feed params:

- `start_at`: optional window start, interpreted as Asia/Shanghai when no timezone is supplied.
- `end_at`: optional window end, interpreted as Asia/Shanghai when no timezone is supplied.
- `source`: optional, default `all`; supported values include `all`, `weixin_mp`, `x`, and `medium`.
- `limit`: optional max item count; the hosted API may cap the value.

Typical response:

```json
{
  "ok": true,
  "generated_at": "2026-06-10T11:00:00.000Z",
  "window": {
    "start_at": "2026-06-10 10:00",
    "end_at": "2026-06-11 09:42",
    "timezone": "Asia/Shanghai",
    "rule": "previous_day_10am_to_current_time"
  },
  "dates": ["2026-06-10", "2026-06-09"],
  "total": 24,
  "items": [
    {
      "id": "2026-06-10-10am:今日精选:1:https://mp.weixin.qq.com/...",
      "date": "2026-06-10",
      "slot": "10am",
      "report_title": "CIO Daily 日报 | 2026-06-10",
      "section_title": "今日精选",
      "title": "GEO 内容怎么写，AI 才更容易引用?",
      "source": "公众号·一路凯歌服务平台",
      "href": "https://mp.weixin.qq.com/...",
      "href_url": "https://mp.weixin.qq.com/...",
      "published_display": "2026-06-10 08:12",
      "captured_display": "2026-06-10 10:00",
      "sort_time": 178104?000
    }
  ]
}
```

Feed behavior:

- Preserve item `id` for unread/new-item state.
- Use `href` / `href_url` for title links.
- Display `captured_display` as the feed card time unless the user specifically asks for original post time.
- Preserve `slot`; do not collapse 10am and 18pm items into a single indistinguishable daily bucket.
- Do not show raw Sogou redirect URLs when an `mp.weixin.qq.com` link is available.

## Status Values

Top-level `status`:

- `ready`: report is generated and can be used.
- `partial`: report is usable, but some links or source counts are unresolved.
- `missing`: no report exists for the requested date/source.
- `error`: server failed to generate the report.

Item `url_status`:

- `resolved`: `url` is a final `mp.weixin.qq.com` article link.
- `fallback`: `url` is unavailable and `fallback_url` should be used.
- `unresolved`: neither final URL nor safe fallback is available.

## Skill Behavior

When API is available:

1. Request `https://daily.wefnews.com/api/feed` by default.
2. For a fixed latest daily report, request `https://daily.wefnews.com/api/reports/daily/latest`.
3. For a specific date, request `https://daily.wefnews.com/api/reports/daily?date=YYYY-MM-DD`.
4. If the hosted report response has `ok: true`, use `report.sections` for display/delivery.
5. Preserve `report.sections` order. Do not merge `X 观察` and `Medium 观察` into the WeChat sections unless the user explicitly asks for a custom output format.
6. If the future normalized response has `status` as `ready` or `partial`, use `report.sections`.
7. Show warnings only when the user asks for operational detail or the report is partial.
8. Do not rerun local crawling.

When API is unavailable:

1. Say the API is unavailable.
2. Do not run local crawling.
3. Report the missing state instead of fabricating content.
