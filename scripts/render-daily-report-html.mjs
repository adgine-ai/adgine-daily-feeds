#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SKILL_ROOT = new URL("../", import.meta.url);
const TEMPLATE_PATH = new URL("templates/daily-report.html", SKILL_ROOT);
const DEFAULT_API_BASE = "https://daily.wefnews.com/api/reports/daily";

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
  const date = readArg("date");
  if (date) {
    const url = new URL(DEFAULT_API_BASE);
    url.searchParams.set("date", date);
    return url.toString();
  }
  return `${DEFAULT_API_BASE}/latest`;
}

function normalizePayload(payload) {
  if (payload?.report) {
    return {
      ok: payload.ok !== false,
      date: payload.date || payload.report.date || null,
      report: payload.report,
      raw: payload,
    };
  }
  if (payload?.raw?.report) {
    return {
      ok: payload.ok !== false,
      date: payload.date || payload.raw.date || payload.raw.report.date || null,
      report: payload.raw.report,
      raw: payload.raw,
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
      const recommendation = item.ai_recommendation
        ? `<div class="recommend">推荐：${escapeHtml(item.ai_recommendation)}</div>`
        : "";
      return `<article class="card">
        <div class="title-row">
          <div class="index">${current}</div>
          <a class="title" href="${escapeAttr(itemHref(item))}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>
        </div>
        <div class="detail">
          <span>来源：${escapeHtml(sourceLabel(item))}</span>
          <span>${escapeHtml(meta.publishedAt)}</span>
          <span class="quality">${escapeHtml(meta.quality)}</span>
        </div>
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
  const footer = `${(report.footer || "@Adgine.ai beta").replace(/^- /, "")} · CIO Daily 日报 · API v0.5.0`;
  return template
    .replaceAll("{{title}}", escapeHtml(report.title || "CIO Daily 日报"))
    .replaceAll("{{theme}}", escapeHtml(normalizeTheme(readArg("theme"))))
    .replaceAll("{{date}}", escapeHtml(shortDate(report.display_captured_at || report.captured_at)))
    .replaceAll("{{displayScope}}", escapeHtml(report.display_scope || "来源：微信公众号"))
    .replaceAll("{{windowText}}", escapeHtml(formatWindow(report)))
    .replaceAll("{{badge}}", escapeHtml("API v0.5.0 · daily.wefnews.com"))
    .replaceAll("{{sampledCount}}", escapeHtml(report.totals?.sampled_count ?? "-"))
    .replaceAll("{{windowCount}}", escapeHtml(report.totals?.window_count ?? "-"))
    .replaceAll("{{selectedCount}}", escapeHtml(report.totals?.selected_count ?? "-"))
    .replaceAll("{{mustReadCount}}", escapeHtml(countMustRead(report)))
    .replaceAll("{{content}}", content)
    .replaceAll("{{footer}}", escapeHtml(footer));
}

async function main() {
  const loaded = await loadReport();
  const template = await readFile(TEMPLATE_PATH, "utf8");
  const html = renderHtml(template, loaded.report);
  const output = readArg("output") || resolve(`data/html/daily-report-${loaded.date || "latest"}.html`);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, html);
  console.log(JSON.stringify({
    ok: true,
    date: loaded.date || null,
    title: loaded.report.title || null,
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
