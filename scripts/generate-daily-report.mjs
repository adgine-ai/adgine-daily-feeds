#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = new URL("../", import.meta.url);
const RAW_DIR = new URL("data/raw/", ROOT);
const FEED_DIR = new URL("data/feed/", ROOT);
const REPORT_DIR = new URL("reports/daily/", ROOT);
const CAPTURE_SCRIPT = new URL("scripts/capture-weixin-sogou.mjs", ROOT);

function readArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function getBeijingParts(date) {
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
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function formatBeijingDate(date) {
  const parts = getBeijingParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatBeijingMinute(date) {
  const parts = getBeijingParts(date);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function parseYmd(value) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid date: ${value}. Expected YYYY-MM-DD.`);
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function beijingTenToUtcMs(ymd) {
  return Date.UTC(ymd.year, ymd.month - 1, ymd.day, 2, 0, 0);
}

function addDays(ymd, days) {
  const date = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + days, 2, 0, 0));
  return parseYmd(formatBeijingDate(date));
}

function getDefaultEndYmd(now = new Date()) {
  const parts = getBeijingParts(now);
  const today = parseYmd(`${parts.year}-${parts.month}-${parts.day}`);
  if (Number(parts.hour) >= 10) {
    return today;
  }
  return addDays(today, -1);
}

function getWindow(endDateArg) {
  const endYmd = endDateArg ? parseYmd(endDateArg) : getDefaultEndYmd();
  const startYmd = addDays(endYmd, -1);
  const startMs = beijingTenToUtcMs(startYmd);
  const endMs = beijingTenToUtcMs(endYmd);
  return {
    startYmd,
    endYmd,
    startMs,
    endMs,
    startLabel: formatBeijingMinute(new Date(startMs)),
    endLabel: formatBeijingMinute(new Date(endMs)),
    dateSlug: `${endYmd.year}-${String(endYmd.month).padStart(2, "0")}-${String(endYmd.day).padStart(2, "0")}`,
  };
}

function allItems(capture) {
  return capture.queries.flatMap((query) =>
    query.items.map((item) => ({
      ...item,
      source_query: query.query,
    }))
  );
}

function itemTimeMs(item) {
  if (item.published_epoch_seconds) {
    return Number(item.published_epoch_seconds) * 1000;
  }
  return Number.NaN;
}

function inWindow(item, window) {
  const time = itemTimeMs(item);
  return Number.isFinite(time) && time >= window.startMs && time < window.endMs;
}

function isUserReadable(item) {
  return ["must_read", "useful"].includes(item.quality_grade)
    && !item.spam_flags?.includes("off_topic")
    && !item.spam_flags?.includes("service_provider_soft_ad");
}

function cleanTitle(title) {
  return title
    .replaceAll("|", "｜")
    .replaceAll(":", "：")
    .replaceAll(";", "；")
    .replaceAll(",", "，")
    .replaceAll("＂", "\"")
    .replace(/&mdash;&mdash;/g, "——");
}

function formatPublishedMinute(item) {
  if (!item.published_at) {
    return "n/a";
  }
  return item.published_at.replace("T", " ").slice(0, 16);
}

function buildRecommendation(item) {
  const title = item.title || "";
  if (/周报|热点关注/.test(title)) {
    return "适合快速扫一遍行业动态，抓住平台、模型、招标和话题变化。";
  }
  if (/官方数据|新报告|数据|流量下滑|归因/.test(title)) {
    return "适合用来校准监测口径，判断 GEO 是否开始进入可量化阶段。";
  }
  if (/误读|花钱买答案|不能做|道德边界|合规|风控|责任/.test(title)) {
    return "适合帮助团队识别 GEO 的风险边界，避免把策略做成短期操纵。";
  }
  if (/AI认知图谱|品牌语料|应用场景|关键词体系|蒸馏词|场景词|品牌词/.test(title)) {
    return "适合内容和品牌团队参考，用来调整语料、关键词和内容结构。";
  }
  if (/实战|案例|实验室|生成式搜索引擎优化/.test(title)) {
    return "适合作为实操参考，观察别人如何把 GEO 方法落到具体项目。";
  }
  return "适合作为今日背景阅读，补充 GEO/AEO 的市场语境和内容样本。";
}

function toReportItem(item) {
  return {
    title: cleanTitle(item.title),
    source: `公众号·${item.account || "未知账号"}`,
    published_label: `${formatPublishedMinute(item)}｜${item.quality_grade} / ${item.quality_score}`,
    url: item.url,
    query: item.source_query,
    quality_reason: item.quality_reason,
    ai_recommendation: buildRecommendation(item),
  };
}

function dedupeItems(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = `${item.title}::${item.account}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

function pickItems(items) {
  return dedupeItems(items)
    .filter(isUserReadable)
    .sort((a, b) => {
      if (b.quality_score !== a.quality_score) {
        return b.quality_score - a.quality_score;
      }
      return itemTimeMs(b) - itemTimeMs(a);
    })
    .slice(0, 10);
}

function buildConclusion(windowItems, selectedItems) {
  const mustReadCount = selectedItems.filter((item) => item.quality_grade === "must_read").length;
  const usefulCount = selectedItems.filter((item) => item.quality_grade === "useful").length;
  return {
    title: `过去 24 小时 GEO/AEO 信息量不低，但值得优先阅读的是 ${selectedItems.length} 条高质量内容。`,
    source: "CIO Daily",
    published_label: `${formatBeijingMinute(new Date())} CST`,
    key_info: "",
    bullets: [
      `内容结构：本轮精选 ${mustReadCount} 条 must_read、${usefulCount} 条 useful，优先覆盖行业动态、方法论、风险边界和数据监测。`,
      "阅读顺序：先看今日精选掌握关键变化，再看延伸阅读补齐方法和案例。",
      "行动建议：品牌/内容团队应重点检查 AI 搜索曝光、内容证据链和合规边界，不建议把 GEO 简化成服务商采购或软文投放。",
    ],
  };
}

function buildUserReport(capture, window, windowItems, selectedItems) {
  return {
    title: `CIO Daily 日报 | ${window.dateSlug}`,
    render_style: "user_daily",
    rule: "微信公众号 / 搜狗微信",
    scope: "微信公众号 / 搜狗微信",
    display_scope: "来源：微信公众号",
    captured_at: capture.captured_at,
    display_captured_at: window.endLabel,
    window: {
      start_at: window.startLabel,
      end_at: window.endLabel,
      timezone: "Asia/Shanghai",
    },
    totals: {
      sampled_count: allItems(capture).length,
      window_count: windowItems.length,
      selected_count: selectedItems.length,
    },
    sections: [
      {
        title: "今日结论",
        items: [buildConclusion(windowItems, selectedItems)],
      },
      {
        title: "今日精选",
        items: selectedItems.slice(0, 5).map(toReportItem),
      },
      {
        title: "延伸阅读",
        items: selectedItems.slice(5, 10).map(toReportItem),
      },
    ],
    footer: "- @Adgine.ai beta",
  };
}

function buildMarkdown(report) {
  const lines = [];
  lines.push(`# ${report.title}`);
  lines.push("");
  lines.push(`${report.display_scope} ｜ ${report.display_captured_at}`);
  lines.push("");
  const conclusion = report.sections[0].items[0];
  lines.push(`## **今日结论 ： ${conclusion.title}**`);
  lines.push("");
  for (const bullet of conclusion.bullets || []) {
    lines.push(`- ${bullet}`);
  }
  lines.push("");
  lines.push("## **今日精选**");
  lines.push("");
  let index = 1;
  for (const section of report.sections.slice(1)) {
    if (section.title !== "今日精选") {
      lines.push(`## **${section.title}**`);
      lines.push("");
    }
    for (const item of section.items) {
      const [publishedAt, quality] = item.published_label.split("｜");
      const href = item.href_url || item.url || "";
      lines.push(`### ${index}. [**${item.title}**](${href})`);
      lines.push("");
      lines.push(`- 来源：${item.source} ｜ ${publishedAt}`);
      lines.push(`- 指数：${quality}`);
      if (item.ai_recommendation) {
        lines.push(`- 推荐：${item.ai_recommendation}`);
      }
      lines.push("");
      index += 1;
    }
  }
  lines.push("");
  lines.push(report.footer);
  lines.push("");
  return lines.join("\n");
}

async function runCaptureIfNeeded(skipCapture) {
  if (skipCapture) {
    return;
  }
  await execFileAsync("node", [CAPTURE_SCRIPT.pathname], {
    cwd: ROOT.pathname,
    timeout: 120000,
  });
}

async function main() {
  await mkdir(FEED_DIR, { recursive: true });
  await mkdir(REPORT_DIR, { recursive: true });
  const window = getWindow(readArg("end-date"));
  await runCaptureIfNeeded(hasFlag("skip-capture"));

  const rawPath = new URL(`weixin-sogou-geo-aeo-baseline-${window.dateSlug}.json`, RAW_DIR);
  const capture = JSON.parse(await readFile(rawPath, "utf8"));
  const items = allItems(capture);
  const windowItems = items.filter((item) => inWindow(item, window));
  const selectedItems = pickItems(windowItems);
  const report = buildUserReport(capture, window, windowItems, selectedItems);
  const markdown = buildMarkdown(report);

  const feedPath = new URL(`cio-daily-10am-window-report-${window.dateSlug}.json`, FEED_DIR);
  const reportPath = new URL(`${window.dateSlug}-cio-daily-10am-window-report.md`, REPORT_DIR);
  await writeFile(feedPath, JSON.stringify(report, null, 2) + "\n");
  await writeFile(reportPath, markdown);

  console.log(JSON.stringify({
    ok: true,
    window: report.window,
    feed: `data/feed/cio-daily-10am-window-report-${window.dateSlug}.json`,
    report: `reports/daily/${window.dateSlug}-cio-daily-10am-window-report.md`,
    totals: report.totals,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error.message,
  }, null, 2));
  process.exit(1);
});
