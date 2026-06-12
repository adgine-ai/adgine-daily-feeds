#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SKILL_ROOT = new URL("../", import.meta.url);
const TEMPLATE_PATH = new URL("templates/daily-report.html", SKILL_ROOT);
const DEFAULT_API_BASE = "https://daily.wefnews.com/api/reports/daily";
const DEFAULT_WEEKLY_API_BASE = "https://daily.wefnews.com/api/reports/weekly";
const SKILL_VERSION = (await readFile(new URL("VERSION", SKILL_ROOT), "utf8")).trim();

function readArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}

function buildApiUrl() {
  const explicitUrl = readArg("api-url") || process.env.ADGINE_DAILY_FEEDS_API_URL;
  if (explicitUrl) {
    return explicitUrl;
  }
  if (process.argv.includes("--weekly")) {
    const startDate = readArg("start-date");
    const endDate = readArg("end-date");
    if (startDate || endDate) {
      const url = new URL(DEFAULT_WEEKLY_API_BASE);
      if (startDate) url.searchParams.set("start_date", startDate);
      if (endDate) url.searchParams.set("end_date", endDate);
      return url.toString();
    }
    return `${DEFAULT_WEEKLY_API_BASE}/latest`;
  }
  const date = readArg("date");
  if (date) {
    const url = new URL(DEFAULT_API_BASE);
    url.searchParams.set("date", date);
    const slot = readArg("slot");
    if (slot) {
      url.searchParams.set("slot", slot);
    }
    return url.toString();
  }
  return `${DEFAULT_API_BASE}/latest`;
}

function normalizePayload(payload) {
  if (payload?.weekly_report) {
    return {
      ok: payload.ok !== false,
      date: payload.end_date || payload.weekly_report?.range?.end || null,
      kind: "weekly",
      weekly_report: payload.weekly_report,
      raw: payload,
    };
  }
  if (payload?.raw?.weekly_report) {
    return {
      ok: payload.ok !== false,
      date: payload.end_date || payload.raw.weekly_report?.range?.end || null,
      kind: "weekly",
      weekly_report: payload.raw.weekly_report,
      raw: payload.raw,
    };
  }
  if (payload?.summary?.top_items && payload?.range) {
    return {
      ok: true,
      date: payload.range.end || null,
      kind: "weekly",
      weekly_report: payload,
      raw: payload,
    };
  }
  if (payload?.report) {
    return {
      ok: payload.ok !== false,
      date: payload.date || payload.report.date || null,
      kind: "daily",
      report: payload.report,
      raw: payload,
    };
  }
  if (payload?.raw?.report) {
    return {
      ok: payload.ok !== false,
      date: payload.date || payload.raw.date || payload.raw.report.date || null,
      kind: "daily",
      report: payload.raw.report,
      raw: payload.raw,
    };
  }
  if (payload?.title && Array.isArray(payload.sections)) {
    return {
      ok: true,
      date: payload.date || null,
      kind: "daily",
      report: payload,
      raw: payload,
    };
  }
  throw new Error("Input does not contain a usable report.");
}

async function loadReport() {
  const input = readArg("input");
  if (input) {
    const payload = JSON.parse(await readFile(input, "utf8"));
    return normalizePayload(payload);
  }

  const apiUrl = buildApiUrl();
  const response = await fetch(apiUrl, {
    headers: {
      Accept: "application/json",
    },
  });
  const payload = JSON.parse(await response.text());
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${payload.error || response.statusText}`);
  }
  return {
    ...normalizePayload(payload),
    api_url: apiUrl,
  };
}

function getConclusion(report) {
  return (report.sections || []).find((section) => section.title === "今日结论")?.items?.[0] || null;
}

function getDisplaySections(report) {
  return (report.sections || []).filter((section) => section.title !== "今日结论");
}

function itemHref(item) {
  return item.href_url || item.url || item.fallback_url || "#";
}

function sourceLabel(item) {
  if (typeof item.source === "string") {
    return item.source;
  }
  return item.source?.label || item.source_label || "未知";
}

function sourcePlatform(item) {
  const source = typeof item.source === "object" ? item.source : null;
  const raw = item.source_platform || item.platform || source?.platform || source?.id || sourceLabel(item);
  const value = String(raw || "").toLowerCase();
  if (value.includes("x") || value.includes("twitter")) {
    return "x";
  }
  if (value.includes("medium")) {
    return "medium";
  }
  if (value.includes("weixin") || value.includes("wechat") || value.includes("公众号")) {
    return "weixin";
  }
  return "other";
}

function platformLabel(platform) {
  return {
    weixin: "公众号",
    x: "X",
    medium: "Medium",
    other: "来源",
  }[platform] || "来源";
}

function splitPublishedLabel(label) {
  const [publishedAt, quality] = String(label || "n/a").split("｜");
  return {
    publishedAt: publishedAt || "n/a",
    quality: quality || "n/a",
  };
}

function renderConclusion(report) {
  const conclusion = getConclusion(report);
  if (!conclusion) {
    return "";
  }
  const bullets = Array.isArray(conclusion.bullets)
    ? `<ul>${conclusion.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`
    : "";
  return `<section class="conclusion"><div class="tag">今日结论</div><div class="summary">${escapeHtml(conclusion.title)}</div>${bullets}</section>`;
}

function renderItems(report) {
  let index = 1;
  return getDisplaySections(report).map((section) => {
    const items = (section.items || []).map((item) => {
      const current = index;
      index += 1;
      const meta = splitPublishedLabel(item.published_label);
      const platform = sourcePlatform(item);
      const recommendation = item.ai_recommendation
        ? `<div class="recommend">推荐：${escapeHtml(item.ai_recommendation)}</div>`
        : "";
      const summary = item.summary || item.key_info
        ? `<div class="summary-text">${escapeHtml(item.summary || item.key_info)}</div>`
        : "";
      const tags = Array.isArray(item.tags) && item.tags.length
        ? `<div class="tags">${item.tags.slice(0, 6).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>`
        : "";
      const metrics = item.metrics && typeof item.metrics === "object"
        ? Object.entries(item.metrics)
            .filter(([, value]) => value !== null && value !== undefined && value !== "")
            .slice(0, 4)
            .map(([key, value]) => `<span>${escapeHtml(key)}: ${escapeHtml(value)}</span>`)
            .join("")
        : "";
      const metricsHtml = metrics ? `<div class="metrics">${metrics}</div>` : "";
      return `<article class="card source-${escapeAttr(platform)}">
        <div class="title-row">
          <div class="index">${current}</div>
          <div class="title-block">
            <div class="source-row">
              <span class="platform-badge platform-${escapeAttr(platform)}">${escapeHtml(platformLabel(platform))}</span>
              <span>${escapeHtml(sourceLabel(item))}</span>
            </div>
            <a class="title" href="${escapeAttr(itemHref(item))}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>
          </div>
        </div>
        <div class="detail">
          <span>${escapeHtml(meta.publishedAt)}</span>
          <span class="quality">${escapeHtml(meta.quality)}</span>
        </div>
        ${summary}
        ${tags}
        ${metricsHtml}
        ${recommendation}
      </article>`;
    }).join("");
    return `<div class="section-title">${escapeHtml(section.title)}</div>${items}`;
  }).join("");
}

function allReportItems(report) {
  return getDisplaySections(report).flatMap((section) => section.items || []);
}

function countMustRead(report) {
  return allReportItems(report).filter((item) => {
    const label = item.published_label || "";
    const grade = item.quality?.grade || "";
    return String(label).includes("must_read") || grade === "must_read";
  }).length;
}

function countSources(report) {
  return new Set(allReportItems(report).map((item) => sourcePlatform(item))).size;
}

function gradeIcon(grade) {
  return {
    must_read: "🔥",
    useful: "🔵",
    watch: "🟣",
  }[grade] || "•";
}

function weeklyTotals(weeklyReport) {
  return weeklyReport.summary?.totals || {};
}

function renderWeeklyConclusion(weeklyReport) {
  const bullets = Array.isArray(weeklyReport.conclusion)
    ? weeklyReport.conclusion
    : [];
  if (!bullets.length) {
    return "";
  }
  return `<section class="conclusion"><div class="tag">本周结论</div><div class="summary">${escapeHtml(bullets[0])}</div><ul>${bullets.slice(1).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul></section>`;
}

function renderWeeklyTopics(weeklyReport) {
  const topics = weeklyReport.summary?.topics || [];
  if (!topics.length) {
    return "";
  }
  const items = topics.slice(0, 8).map((topic) => {
    return `<article class="card">
      <div class="title-row">
        <div class="index">${escapeHtml(topic.count ?? "-")}</div>
        <div class="title-block">
          <div class="source-row"><span class="platform-badge">主题趋势</span></div>
          <div class="title">${escapeHtml(topic.topic || "未命名主题")}</div>
        </div>
      </div>
    </article>`;
  }).join("");
  return `<div class="section-title">主题趋势</div>${items}`;
}

function renderWeeklyItems(weeklyReport) {
  const items = weeklyReport.summary?.top_items || [];
  if (!items.length) {
    return "";
  }
  const cards = items.slice(0, 10).map((item, itemIndex) => {
    const platform = sourcePlatform(item);
    const href = item.url || item.href_url || "#";
    const grade = item.quality?.grade || "n/a";
    const score = item.quality?.score ?? "-";
    const recommendation = item.recommendation || item.ai_recommendation
      ? `<div class="recommend">推荐：${escapeHtml(item.recommendation || item.ai_recommendation)}</div>`
      : "";
    return `<article class="card source-${escapeAttr(platform)}">
      <div class="title-row">
        <div class="index">${itemIndex + 1}</div>
        <div class="title-block">
          <div class="source-row">
            <span class="platform-badge platform-${escapeAttr(platform)}">${escapeHtml(platformLabel(platform))}</span>
            <span>${escapeHtml(item.source || sourceLabel(item))}</span>
            <span>${escapeHtml(item.published_at || "n/a")}</span>
          </div>
          <a class="title" href="${escapeAttr(href)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>
        </div>
      </div>
      <div class="detail">
        <span>${escapeHtml(item.section || "本周优先阅读")}</span>
        <span class="quality">${escapeHtml(`${gradeIcon(grade)} ${grade} / ${score}`)}</span>
      </div>
      ${recommendation}
    </article>`;
  }).join("");
  return `<div class="section-title">本周优先阅读</div>${cards}`;
}

function shortDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : String(value || "latest");
}

function formatWindow(report) {
  if (!report.window?.start_at || !report.window?.end_at) {
    return "窗口：latest";
  }
  return `窗口：${report.window.start_at} -> ${report.window.end_at}`;
}

function normalizeTheme(theme) {
  return theme === "dark" ? "dark" : "light";
}

function renderHtml(template, report) {
  const content = `${renderConclusion(report)}${renderItems(report)}`;
  const footer = `${(report.footer || "@Adgine.ai beta").replace(/^- /, "")} · CIO Daily 日报 · API ${SKILL_VERSION}`;
  return template
    .replaceAll("{{title}}", escapeHtml(report.title || "CIO Daily 日报"))
    .replaceAll("{{theme}}", escapeHtml(normalizeTheme(readArg("theme"))))
    .replaceAll("{{date}}", escapeHtml(shortDate(report.display_captured_at || report.captured_at)))
    .replaceAll("{{displayScope}}", escapeHtml(report.display_scope || "来源：微信公众号"))
    .replaceAll("{{windowText}}", escapeHtml(formatWindow(report)))
    .replaceAll("{{badge}}", escapeHtml(`API ${SKILL_VERSION} · daily.wefnews.com`))
    .replaceAll("{{sampledCount}}", escapeHtml(report.totals?.sampled_count ?? "-"))
    .replaceAll("{{windowCount}}", escapeHtml(report.totals?.window_count ?? "-"))
    .replaceAll("{{selectedCount}}", escapeHtml(report.totals?.selected_count ?? "-"))
    .replaceAll("{{mustReadCount}}", escapeHtml(countMustRead(report)))
    .replaceAll("{{sourceCount}}", escapeHtml(report.totals?.source_count ?? countSources(report)))
    .replaceAll("{{content}}", content)
    .replaceAll("{{footer}}", escapeHtml(footer));
}

function renderWeeklyHtml(template, weeklyReport) {
  const totals = weeklyTotals(weeklyReport);
  const bySource = weeklyReport.summary?.by_source || {};
  const byQuality = weeklyReport.summary?.by_quality || {};
  const range = weeklyReport.range || {};
  const sourceSummary = [
    `公众号 ${bySource.weixin_mp || 0}`,
    `X ${bySource.x || 0}`,
    `Medium ${bySource.medium || 0}`,
  ].join(" / ");
  const qualitySummary = [
    `must_read ${byQuality.must_read || 0}`,
    `useful ${byQuality.useful || 0}`,
    `watch ${byQuality.watch || 0}`,
  ].join(" / ");
  const content = `${renderWeeklyConclusion(weeklyReport)}${renderWeeklyTopics(weeklyReport)}${renderWeeklyItems(weeklyReport)}`;
  const footer = `@Adgine.ai beta · CIO Daily 周报 · API ${SKILL_VERSION}`;
  return template
    .replaceAll("{{title}}", escapeHtml(weeklyReport.title || "CIO Daily 周报"))
    .replaceAll("{{theme}}", escapeHtml(normalizeTheme(readArg("theme"))))
    .replaceAll("{{date}}", escapeHtml(`${range.start || "latest"} - ${range.end || "latest"}`))
    .replaceAll("{{displayScope}}", escapeHtml(`来源：${sourceSummary}`))
    .replaceAll("{{windowText}}", escapeHtml(`质量：${qualitySummary}`))
    .replaceAll("{{badge}}", escapeHtml(`API ${SKILL_VERSION} · daily.wefnews.com · weekly`))
    .replaceAll("{{sampledCount}}", escapeHtml(totals.raw_weixin_unique_items ?? "-"))
    .replaceAll("{{windowCount}}", escapeHtml(totals.days_with_daily_report ?? "-"))
    .replaceAll("{{selectedCount}}", escapeHtml(totals.selected_unique_items ?? weeklyReport.summary?.top_items?.length ?? "-"))
    .replaceAll("{{mustReadCount}}", escapeHtml(byQuality.must_read || 0))
    .replaceAll("{{sourceCount}}", escapeHtml(Object.values(bySource).filter((count) => Number(count) > 0).length || "-"))
    .replaceAll("{{content}}", content)
    .replaceAll("{{footer}}", escapeHtml(footer));
}

async function main() {
  const loaded = await loadReport();
  const template = await readFile(TEMPLATE_PATH, "utf8");
  const html = loaded.weekly_report
    ? renderWeeklyHtml(template, loaded.weekly_report)
    : renderHtml(template, loaded.report);
  const output = readArg("output") || resolve(`data/html/${loaded.weekly_report ? "weekly" : "daily"}-report-${loaded.date || "latest"}.html`);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, html);
  console.log(JSON.stringify({
    ok: true,
    date: loaded.date || null,
    kind: loaded.kind || (loaded.weekly_report ? "weekly" : "daily"),
    title: loaded.report?.title || loaded.weekly_report?.title || null,
    output,
    api_url: loaded.api_url || null,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error.message,
  }, null, 2));
  process.exit(1);
});
