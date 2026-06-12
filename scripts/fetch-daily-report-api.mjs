#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const DEFAULT_API_BASE = "https://daily.wefnews.com/api/reports/daily";
const DEFAULT_FEED_API = "https://daily.wefnews.com/api/feed";
const DEFAULT_WEEKLY_API_BASE = "https://daily.wefnews.com/api/reports/weekly";

function readArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function shanghaiParts(date) {
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

function shanghaiTimeToEpochMs(dateSlug, time = "00:00:00") {
  return Date.parse(`${dateSlug}T${time}+08:00`);
}

function defaultFeedWindow(now = new Date()) {
  const current = shanghaiParts(now);
  const todayStartMs = shanghaiTimeToEpochMs(`${current.year}-${current.month}-${current.day}`);
  const yesterdayStart = new Date(todayStartMs - 24 * 60 * 60 * 1000);
  const previous = shanghaiParts(yesterdayStart);
  return {
    start_at: `${previous.year}-${previous.month}-${previous.day} 10:00`,
    end_at: `${current.year}-${current.month}-${current.day} ${current.hour}:${current.minute}`,
  };
}

function buildUrl() {
  const explicitUrl = readArg("api-url") || process.env.ADGINE_DAILY_FEEDS_API_URL;
  if (explicitUrl) {
    return explicitUrl;
  }

  if (!process.argv.includes("--report")) {
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

    const url = new URL(DEFAULT_FEED_API);
    const window = defaultFeedWindow();
    url.searchParams.set("start_at", readArg("start-at") || process.env.ADGINE_DAILY_FEEDS_START_AT || window.start_at);
    url.searchParams.set("end_at", readArg("end-at") || process.env.ADGINE_DAILY_FEEDS_END_AT || window.end_at);
    const source = readArg("source") || process.env.ADGINE_DAILY_FEEDS_SOURCE;
    const limit = readArg("limit") || process.env.ADGINE_DAILY_FEEDS_LIMIT;
    if (source) url.searchParams.set("source", source);
    if (limit) url.searchParams.set("limit", limit);
    return url.toString();
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

function normalizeResponse(data) {
  if (data?.ok === true && data.weekly_report) {
    return {
      ok: true,
      source: "hosted_weekly_api",
      date: data.end_date || data.weekly_report?.range?.end || null,
      slot: "weekly",
      weekly_report: data.weekly_report,
      raw: data,
    };
  }

  if (data?.summary?.top_items && data?.range) {
    return {
      ok: true,
      source: "weekly_report_json",
      date: data.range.end || null,
      slot: "weekly",
      weekly_report: data,
      raw: data,
    };
  }

  if (data?.ok === true && data.report) {
    return {
      ok: true,
      source: "hosted_api",
      date: data.date || data.report.date || null,
      slot: data.slot || data.report?.window?.slot || null,
      report: data.report,
      raw: data,
    };
  }

  if (data?.ok === true && Array.isArray(data.items)) {
    return {
      ok: true,
      source: "hosted_feed_api",
      date: data.dates?.[0] || null,
      slot: null,
      report: null,
      feed: data,
      raw: data,
    };
  }

  if (["ready", "partial"].includes(data?.status) && data.report) {
    return {
      ok: true,
      source: "normalized_api",
      date: data.date || null,
      slot: data.slot || data.report?.window?.slot || null,
      report: data.report,
      raw: data,
    };
  }

  return {
    ok: false,
    source: "api",
    error: data?.error || data?.message || "Daily report API did not return a usable report.",
    raw: data,
  };
}

async function main() {
  const url = buildUrl();
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`API did not return JSON: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${data.error || response.statusText}`);
  }

  const normalized = normalizeResponse(data);
  const output = readArg("output");
  if (output) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(normalized, null, 2) + "\n");
  }

  console.log(JSON.stringify({
    ok: normalized.ok,
    api_url: url,
    source: normalized.source,
    date: normalized.date || null,
    slot: normalized.slot || null,
    window: normalized.feed?.window || null,
    title: normalized.report?.title || null,
    weekly_title: normalized.weekly_report?.title || null,
    sections: normalized.report?.sections?.map((section) => ({
      title: section.title,
      item_count: section.items?.length || 0,
    })) || [],
    weekly_top_items: normalized.weekly_report?.summary?.top_items?.length ?? null,
    feed_total: normalized.feed?.total ?? null,
    feed_dates: normalized.feed?.dates || null,
    output: output || null,
    error: normalized.ok ? null : normalized.error,
  }, null, 2));

  if (!normalized.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error.message,
  }, null, 2));
  process.exit(1);
});
