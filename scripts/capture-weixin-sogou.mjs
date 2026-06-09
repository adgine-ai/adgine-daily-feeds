#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";

const OUTPUT_DIR = new URL("../data/raw/", import.meta.url);
const FEED_DIR = new URL("../data/feed/", import.meta.url);
const REPORT_DIR = new URL("../reports/daily/", import.meta.url);
const SEARCH_BASE = "https://weixin.sogou.com/weixin";
const CAPTURED_AT = new Date();
const TODAY_YYYY_MM_DD = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(CAPTURED_AT);

const queries = [
  {
    id: "geo",
    query: "GEO",
    pages: 10,
  },
  {
    id: "aeo_raw",
    query: "AEO",
    pages: 10,
  },
  {
    id: "aeo_search_optimization",
    query: "AEO 搜索优化",
    pages: 10,
  },
  {
    id: "aeo_answer_engine",
    query: "AEO 答案引擎优化",
    pages: 10,
  },
];

function decodeEntities(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&ldquo;", "“")
    .replaceAll("&rdquo;", "”")
    .replaceAll("&nbsp;", " ");
}

function stripHtml(value) {
  return decodeEntities(value)
    .replaceAll(/<em><!--red_beg-->/g, "")
    .replaceAll(/<!--red_end--><\/em>/g, "")
    .replaceAll(/<[^>]+>/g, "")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function toAbsoluteSogouUrl(href) {
  const decoded = decodeEntities(href);
  if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
    return decoded;
  }
  return `https://weixin.sogou.com${decoded}`;
}

function getBeijingDateFromEpochSeconds(epochSeconds) {
  if (!epochSeconds) {
    return null;
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Number(epochSeconds) * 1000));
}

function getBeijingDateTimeFromEpochSeconds(epochSeconds) {
  if (!epochSeconds) {
    return null;
  }
  const date = new Date(Number(epochSeconds) * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}T${byType.hour}:${byType.minute}:${byType.second}+08:00`;
}

function parseTotalCount(html) {
  const match = html.match(/找到约([\d,]+)条结果/);
  return match ? Number(match[1].replaceAll(",", "")) : null;
}

function parseItems(html, query, page) {
  const itemBlocks = html.match(/<li id="sogou_vr_11002601_box_[\s\S]*?<\/li>/g) || [];
  return itemBlocks.map((block, index) => {
    const titleMatch = block.match(/<h3>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/);
    const summaryMatch = block.match(/<p class="txt-info"[^>]*>([\s\S]*?)<\/p>/);
    const accountMatch = block.match(/<span class="all-time-y2">([\s\S]*?)<\/span>/);
    const timeMatch = block.match(/timeConvert\('(\d+)'\)/);
    const epochSeconds = timeMatch?.[1] || null;
    const publishedDate = getBeijingDateFromEpochSeconds(epochSeconds);
    const publishedAt = getBeijingDateTimeFromEpochSeconds(epochSeconds);

    return {
      id: `${query}_${page}_${index + 1}`,
      query,
      page,
      rank_on_page: index + 1,
      global_rank: (page - 1) * 10 + index + 1,
      title: titleMatch ? stripHtml(titleMatch[2]) : "",
      account: accountMatch ? stripHtml(accountMatch[1]) : "",
      url: titleMatch ? toAbsoluteSogouUrl(titleMatch[1]) : null,
      summary: summaryMatch ? stripHtml(summaryMatch[1]) : "",
      published_epoch_seconds: epochSeconds ? Number(epochSeconds) : null,
      published_at: publishedAt,
      published_date: publishedDate,
      is_today: publishedDate === TODAY_YYYY_MM_DD,
      engagement_metrics: {
        source_platform: "weixin_mp",
        metric_status: "unavailable",
        collected_at: new Intl.DateTimeFormat("sv-SE", {
          timeZone: "Asia/Shanghai",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(CAPTURED_AT).replace(" ", "T") + "+08:00",
        status_note: "搜狗微信搜索结果页不提供阅读量、收藏、点赞、在看或评论量。",
      },
    };
  }).filter((item) => item.title);
}

function hasNextPage(html, nextPage) {
  return html.includes(`id="sogou_page_${nextPage}"`) || html.includes(`page=${nextPage}`);
}

function scoreItem(item) {
  const haystack = `${item.title} ${item.summary}`;
  const spamFlags = [];
  let score = 35;

  if (/GeoAI|GeoShapley|Geoderma|地理|地理空间|空间大数据|遥感|土壤|植物|生信|RNA|数据库|渗流|边坡|肝纤维化|CCl|公共数据库|坡|岩土|地质|GIS/i.test(haystack)) {
    spamFlags.push("off_topic");
    score -= 45;
  }
  if (/海关|认证|经认证的经营者|通关|关务|报关|进出口|AEO企业|互认国家/.test(haystack)) {
    spamFlags.push("off_topic");
    score -= 45;
  }
  if (/哪家|哪家强|哪家好|哪个公司|公司有哪些|排名|十大|推荐|报价|口碑|联系方式|全收录|合作渠道|本地靠谱|少踩坑|平台怎么选/.test(haystack)) {
    spamFlags.push("service_provider_soft_ad");
    score -= 30;
  }
  if (/服务商|优化公司|GEO公司|公司.*GEO|发稿平台|软文|代发|推广平台|获客|拓客|引流|主动找你|主动推荐|诊断福利|私享会|客户主动|低价内卷|老板做GEO|劝老板|营销赛道|数字营销新引擎|效果更好|少花冤枉钱/.test(haystack)) {
    spamFlags.push("service_provider_soft_ad");
    score -= 20;
  }
  if (/包上|保证|霸屏|快速|割韭菜|捷径|全盘归零|致命错误|砸钱|风口/.test(haystack)) {
    spamFlags.push("misleading_guarantee");
    score -= 18;
  }
  if (/官方|数据|截图|案例|方法论|实战|路径|归因|ROI|合规|风控|幻觉|报告|周报|招标|奖|Google|谷歌|Search Console|工具|模型|品牌|AI搜索|答案引擎|生成式引擎/.test(haystack)) {
    score += 18;
  }
  if (/GEO|AEO|AI搜索|生成式引擎|答案引擎|SEO/.test(haystack)) {
    score += 8;
  }
  if (item.is_today) {
    score += 12;
  }
  if (item.account && /深响|GEO新营销|询盘云|Neo|白武士|Lakeread|融中财经/.test(item.account)) {
    score += 8;
  }

  if (spamFlags.includes("off_topic")) {
    score = Math.min(score, 25);
  } else if (spamFlags.includes("service_provider_soft_ad")) {
    score = Math.min(score, 44);
  } else if (spamFlags.includes("misleading_guarantee")) {
    score = Math.min(score, 55);
  }

  score = Math.max(0, Math.min(100, score));
  let grade = "exclude";
  if (score >= 80) {
    grade = "must_read";
  } else if (score >= 60) {
    grade = "useful";
  } else if (score >= 45) {
    grade = "archive";
  }

  return {
    quality_score: score,
    quality_grade: grade,
    spam_flags: spamFlags,
    quality_reason: buildQualityReason(score, grade, spamFlags),
  };
}

function buildQualityReason(score, grade, spamFlags) {
  if (spamFlags.includes("off_topic")) {
    return "主题偏离 GEO/AEO 搜索优化，主要作为噪音计数。";
  }
  if (spamFlags.includes("service_provider_soft_ad")) {
    return "标题/摘要呈现服务商软文或采购模板特征，作为市场热度信号，不作为必读内容。";
  }
  if (grade === "must_read") {
    return "具备较强时效性、主题相关性和可行动信息，建议进入日报正文。";
  }
  if (grade === "useful") {
    return "主题相关且有一定方法/风险/市场信号，适合进入可扫列表。";
  }
  if (grade === "archive") {
    return "可作为背景或趋势归档，但信息增量不足。";
  }
  return `质量分 ${score}，未达到入库或推送标准。`;
}

async function fetchSearchPage(query, page) {
  const url = new URL(SEARCH_BASE);
  url.searchParams.set("ie", "utf8");
  url.searchParams.set("type", "2");
  url.searchParams.set("query", query);
  url.searchParams.set("page", String(page));

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      Referer: "https://weixin.sogou.com/",
    },
  });
  const html = await response.text();
  return {
    url: url.toString(),
    status_code: response.status,
    redirected: response.redirected,
    final_url: response.url,
    html,
  };
}

async function captureQuery(queryConfig) {
  const pages = [];
  const items = [];
  let approximateTotal = null;

  for (let page = 1; page <= queryConfig.pages; page += 1) {
    const result = await fetchSearchPage(queryConfig.query, page);
    const pageItems = parseItems(result.html, queryConfig.query, page).map((item) => ({
      ...item,
      ...scoreItem(item),
    }));
    approximateTotal ??= parseTotalCount(result.html);
    pages.push({
      page,
      url: result.url,
      final_url: result.final_url,
      status_code: result.status_code,
      redirected: result.redirected,
      item_count: pageItems.length,
    });
    items.push(...pageItems);

    if (pageItems.length === 0 || !hasNextPage(result.html, page + 1)) {
      break;
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const item of items) {
    const key = `${item.title}::${item.account}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }

  const todayItems = deduped.filter((item) => item.is_today);
  return {
    id: queryConfig.id,
    query: queryConfig.query,
    approximate_total: approximateTotal,
    pages,
    sampled_count: deduped.length,
    today_count: todayItems.length,
    today_high_quality_count: todayItems.filter((item) => ["must_read", "useful"].includes(item.quality_grade)).length,
    today_low_quality_count: todayItems.filter((item) => item.quality_grade === "archive").length,
    today_excluded_count: todayItems.filter((item) => item.quality_grade === "exclude").length,
    items: deduped,
    today_items: todayItems,
  };
}

function buildMarketSnapshot(capture) {
  const channels = capture.queries.map((query) => ({
    channel: "weixin_sogou",
    query: query.query,
    source_url: query.pages[0]?.url || null,
    status: "sample_only",
    sampled_count: query.sampled_count,
    today_count: query.today_count,
    relevant_count: query.today_items.filter((item) => !item.spam_flags.includes("off_topic")).length,
    high_quality_count: query.today_high_quality_count,
    low_quality_count: query.today_low_quality_count,
    noise_count: query.today_excluded_count,
    estimated_total: query.approximate_total,
    estimate_note: "estimated_total 来自搜狗页面“找到约 N 条结果”，不是今日总量；today_count 来自本轮可见分页的发布时间过滤。",
  }));

  return {
    id: `keyword_market_snapshot_${TODAY_YYYY_MM_DD.replaceAll("-", "_")}_weixin_geo_aeo`,
    date: TODAY_YYYY_MM_DD,
    keyword_group: "GEO_AEO",
    source: "weixin_sogou",
    captured_at: capture.captured_at,
    status_note: "搜狗微信公开搜索 baseline。今日量为可见分页样本，不代表完整公众号全量。",
    channels,
    totals: channels.reduce((acc, channel) => {
      acc.sampled_count += channel.sampled_count;
      acc.today_count += channel.today_count;
      acc.relevant_count += channel.relevant_count;
      acc.high_quality_count += channel.high_quality_count;
      acc.low_quality_count += channel.low_quality_count;
      acc.noise_count += channel.noise_count;
      return acc;
    }, {
      sampled_count: 0,
      today_count: 0,
      relevant_count: 0,
      high_quality_count: 0,
      low_quality_count: 0,
      noise_count: 0,
    }),
  };
}

function buildReport(capture, snapshot) {
  const lines = [
    `# 搜狗微信 GEO/AEO 今日 Baseline｜${TODAY_YYYY_MM_DD}`,
    "",
    `采集时间：${capture.captured_at}`,
    "",
    "说明：本报告用于后续增量维护。`estimated_total` 是搜狗页面展示的约总结果数，不是今日总量；今日结果来自本轮可见分页里的发布时间过滤。",
    "",
    "## 1. 今日大盘",
    "",
    "| 查询词 | 搜狗约总量 | 本轮样本 | 今日样本 | 今日高质量 | 今日低质量 | 今日过滤/噪音 |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const channel of snapshot.channels) {
    lines.push(`| \`${channel.query}\` | ${channel.estimated_total ?? "n/a"} | ${channel.sampled_count} | ${channel.today_count} | ${channel.high_quality_count} | ${channel.low_quality_count} | ${channel.noise_count} |`);
  }

  lines.push(
    "",
    "## 2. 今日高质量 / 可扫条目",
    ""
  );

  const highQualityItems = capture.queries
    .flatMap((query) => query.today_items.map((item) => ({ ...item, source_query: query.query })))
    .filter((item) => ["must_read", "useful"].includes(item.quality_grade))
    .sort((a, b) => b.quality_score - a.quality_score);

  if (highQualityItems.length === 0) {
    lines.push("今日搜狗微信样本中没有达到 `useful` 以上的高质量条目。");
  } else {
    for (const [index, item] of highQualityItems.entries()) {
      lines.push(
        `${index + 1}. [${item.title}](${item.url})`,
        `   - 查询词：${item.source_query}`,
        `   - 来源：公众号·${item.account}`,
        `   - 发布时间：${item.published_at}`,
        `   - 质量：${item.quality_grade} / ${item.quality_score}`,
        `   - 判断：${item.quality_reason}`,
        ""
      );
    }
  }

  lines.push(
    "## 3. 今日低质量/软文信号",
    ""
  );

  const lowQualityItems = capture.queries
    .flatMap((query) => query.today_items.map((item) => ({ ...item, source_query: query.query })))
    .filter((item) => item.spam_flags.length > 0 || item.quality_grade === "exclude")
    .slice(0, 30);

  for (const [index, item] of lowQualityItems.entries()) {
    lines.push(
      `${index + 1}. ${item.title}`,
      `   - 查询词：${item.source_query}`,
      `   - 来源：公众号·${item.account}`,
      `   - 发布时间：${item.published_at}`,
      `   - 质量：${item.quality_grade} / ${item.quality_score}`,
      `   - 过滤原因：${item.quality_reason}`,
      ""
    );
  }

  lines.push(
    "## 4. 增量维护规则",
    "",
    "- 下一轮抓取时，用 `title + account` 做基础去重。",
    "- 新增且 `quality_grade` 为 `must_read/useful` 的条目进入日报候选。",
    "- 新增但低质量的条目只更新大盘计数，不进入日报正文。",
    "- `AEO` 不再单搜，默认使用 `AEO 搜索优化` 和 `AEO 答案引擎优化`。"
  );

  return `${lines.join("\n")}\n`;
}

function buildIncrementalState(capture) {
  return {
    id: `weixin_sogou_incremental_state_${TODAY_YYYY_MM_DD.replaceAll("-", "_")}`,
    date: TODAY_YYYY_MM_DD,
    source: "weixin_sogou",
    captured_at: capture.captured_at,
    key_strategy: "title + account",
    item_count: capture.queries.reduce((count, query) => count + query.today_items.length, 0),
    items: capture.queries.flatMap((query) => query.today_items.map((item) => ({
      key: `${item.title}::${item.account}`,
      query: query.query,
      title: item.title,
      account: item.account,
      published_at: item.published_at,
      quality_grade: item.quality_grade,
      quality_score: item.quality_score,
      url: item.url,
    }))),
  };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(FEED_DIR, { recursive: true });
  await mkdir(REPORT_DIR, { recursive: true });

  const capturedAt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(CAPTURED_AT).replace(" ", "T") + "+08:00";

  const capture = {
    capture_id: `weixin_sogou_geo_aeo_baseline_${TODAY_YYYY_MM_DD.replaceAll("-", "_")}`,
    captured_at: capturedAt,
    source: "sogou_weixin",
    status: "live_verified",
    purpose: "today_baseline_for_incremental_maintenance",
    limitations: [
      "搜狗微信最多展示有限分页；本次按可见分页采集，不代表全量。",
      "estimated_total 是搜索页约总量，不是今日总量。",
      "微信公众号跳转链接可能短期失效。",
      "今日判断基于搜索页发布时间时间戳过滤。",
    ],
    queries: [],
  };

  for (const query of queries) {
    capture.queries.push(await captureQuery(query));
  }

  const snapshot = buildMarketSnapshot(capture);
  const incrementalState = buildIncrementalState(capture);
  const report = buildReport(capture, snapshot);

  const dateSlug = TODAY_YYYY_MM_DD;
  await writeFile(new URL(`weixin-sogou-geo-aeo-baseline-${dateSlug}.json`, OUTPUT_DIR), JSON.stringify(capture, null, 2) + "\n");
  await writeFile(new URL(`weixin-sogou-keyword-market-snapshot-${dateSlug}.json`, FEED_DIR), JSON.stringify(snapshot, null, 2) + "\n");
  await writeFile(new URL(`weixin-sogou-incremental-state-${dateSlug}.json`, FEED_DIR), JSON.stringify(incrementalState, null, 2) + "\n");
  await writeFile(new URL(`${dateSlug}-weixin-sogou-geo-aeo-baseline.md`, REPORT_DIR), report);

  console.log(JSON.stringify({
    ok: true,
    captured_at: capturedAt,
    raw: `data/raw/weixin-sogou-geo-aeo-baseline-${dateSlug}.json`,
    snapshot: `data/feed/weixin-sogou-keyword-market-snapshot-${dateSlug}.json`,
    state: `data/feed/weixin-sogou-incremental-state-${dateSlug}.json`,
    report: `reports/daily/${dateSlug}-weixin-sogou-geo-aeo-baseline.md`,
    totals: snapshot.totals,
    channels: snapshot.channels.map((channel) => ({
      query: channel.query,
      estimated_total: channel.estimated_total,
      sampled_count: channel.sampled_count,
      today_count: channel.today_count,
      high_quality_count: channel.high_quality_count,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error.message,
  }, null, 2));
  process.exit(1);
});
