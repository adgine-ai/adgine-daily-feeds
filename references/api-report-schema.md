# Daily Report API Schema

Version: `v0.3.0`

The API layer returns generated daily report results only. Crawling, browser-based WeChat URL resolution, scoring, deduplication, and scheduling happen on the server side before this API is consumed.

## Principle

Keep the skill simple:

- Fetch a generated daily report JSON from the API.
- Display it, summarize it, or deliver it to a configured channel.
- Do not make every agent crawl Sogou Weixin or resolve WeChat links.
- If the API is unavailable, report the missing state. This skill no longer includes local crawling fallback.

## Endpoint

Default hosted endpoint:

```http
GET https://daily.wefnews.com/api/reports/daily/latest
GET https://daily.wefnews.com/api/reports/daily?date=YYYY-MM-DD
```

The current hosted response is:

```json
{
  "ok": true,
  "date": "2026-06-09",
  "report": {}
}
```

Use `report.sections` directly. If `ok` is not `true`, treat the report as unavailable and do not fabricate content.

Future normalized endpoint:

```http
GET /v1/reports/daily?date=YYYY-MM-DD&source=weixin_sogou
```

Default parameters:

- `date`: report end date in `Asia/Shanghai`.
- `source`: default `weixin_sogou`.
- `format`: optional, default `json`.

## Response

```json
{
  "api_version": "v1",
  "status": "ready",
  "report_id": "cio_daily_2026_06_09_weixin_sogou_10am",
  "date": "2026-06-09",
  "timezone": "Asia/Shanghai",
  "source": {
    "id": "weixin_sogou",
    "label": "微信公众号",
    "raw_provider": "sogou_weixin"
  },
  "window": {
    "start_at": "2026-06-08T10:00:00+08:00",
    "end_at": "2026-06-09T10:00:00+08:00"
  },
  "generated_at": "2026-06-09T10:17:00+08:00",
  "report": {
    "title": "CIO Daily 日报 | 2026-06-09",
    "render_style": "user_daily",
    "display_scope": "来源：微信公众号",
    "display_captured_at": "2026-06-09 10:00",
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
      }
    ],
    "footer": "- @Adgine.ai beta"
  },
  "items": [],
  "meta": {
    "sampled_count": 363,
    "window_count": 67,
    "selected_count": 10,
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

1. Request `https://daily.wefnews.com/api/reports/daily/latest` by default.
2. For a specific date, request `https://daily.wefnews.com/api/reports/daily?date=YYYY-MM-DD`.
3. If the hosted response has `ok: true`, use `report.sections` for display/delivery.
4. If the future normalized response has `status` as `ready` or `partial`, use `report.sections`.
5. Show warnings only when the user asks for operational detail or the report is partial.
6. Do not rerun local crawling.

When API is unavailable:

1. Say the API is unavailable.
2. Do not run local crawling.
3. Report the missing state instead of fabricating content.
