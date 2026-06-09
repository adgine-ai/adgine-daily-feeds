# WeChat/Sogou Source Notes

Version: `v0.1.0`

## Source Contract

Primary source in v0.1.0:

- Sogou Weixin article search: `https://weixin.sogou.com/weixin?type=2&query=<keyword>`
- Source label in reports: `公众号·<account name>`
- User-facing source scope: `来源：微信公众号`

## Capture Rules

- Capture raw Sogou result pages first.
- Keep result metadata: title, account, summary, publish time, query, rank, Sogou URL.
- Resolve final article URLs when possible by opening Sogou `/link` redirects and recording the resulting `https://mp.weixin.qq.com/...` URL.
- If final URL resolution fails, keep the Sogou URL internally but mark the user-facing item as unresolved.

## Known Limitations

- Sogou search can be rate-limited, blocked, or return partial results.
- Sogou usually does not expose WeChat reads, likes, comments, favorites, or collection count.
- Some Sogou `/link` URLs expire or produce parameter errors.
- A visible article page may still be unavailable due to WeChat restrictions.

## Noise Filters

Exclude or down-rank:

- `GEO` as geography, GIS, geolocation, geology, or unrelated location data.
- `AEO` as customs Authorized Economic Operator unless the task explicitly includes customs.
- Service-provider soft ads with no method, data, or example.
- "哪家强 / 排名 / 代运营 / 保上 AI 答案" style advertorials.
- Articles that only restate definitions without adding useful process, evidence, or new signal.

## Useful Signals

Raise score for:

- Official platform/model/search updates.
- Original data, screenshots, experiments, benchmark results, or case studies.
- Clear methodology, checklist, decision tree, or implementation sequence.
- Risk, compliance, hallucination, and brand-safety discussion.
- Content structure guidance that can become an internal playbook.
