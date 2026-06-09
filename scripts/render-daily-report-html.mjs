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
  return `<section><h2>今日结论</h2><p class="lead">${escapeHtml(conclusion.title)}</p>${bullets}</section>`;
}

function renderItems(report) {
  let index = 1;
  return getDisplaySections(report).map((section) => {
    const items = (section.items || []).map((item) => {
      const current = index;
      index += 1;
      const meta = splitPublishedLabel(item.published_label);
      const recommendation = item.ai_recommendation
        ? `<p class="recommendation">推荐：${escapeHtml(item.ai_recommendation)}</p>`
        : "";
      return `<article>
        <div class="index">${current}</div>
        <div>
          <a class="title" href="${escapeAttr(itemHref(item))}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>
          <div class="chips">
            <span class="chip">来源：${escapeHtml(item.source || item.source?.label || "未知")}</span>
            <span class="chip">${escapeHtml(meta.publishedAt)}</span>
            <span class="chip">指数：${escapeHtml(meta.quality)}</span>
          </div>
          ${recommendation}
        </div>
      </article>`;
    }).join("");
    return `<section><h2>${escapeHtml(section.title)}</h2><div class="items">${items}</div></section>`;
  }).join("");
}

function renderHtml(template, report) {
  const windowLabel = report.window?.start_at && report.window?.end_at
    ? ` ｜ 窗口：${report.window.start_at} - ${report.window.end_at}`
    : "";
  const content = `${renderConclusion(report)}${renderItems(report)}`;
  return template
    .replaceAll("{{title}}", escapeHtml(report.title || "CIO Daily 日报"))
    .replaceAll("{{displayScope}}", escapeHtml(report.display_scope || "来源：微信公众号"))
    .replaceAll("{{capturedAt}}", escapeHtml(report.display_captured_at || report.captured_at || ""))
    .replaceAll("{{windowLabel}}", escapeHtml(windowLabel))
    .replaceAll("{{sampledCount}}", escapeHtml(report.totals?.sampled_count ?? "-"))
    .replaceAll("{{windowCount}}", escapeHtml(report.totals?.window_count ?? "-"))
    .replaceAll("{{selectedCount}}", escapeHtml(report.totals?.selected_count ?? "-"))
    .replaceAll("{{content}}", content)
    .replaceAll("{{footer}}", escapeHtml(report.footer || "- @Adgine.ai beta"));
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
