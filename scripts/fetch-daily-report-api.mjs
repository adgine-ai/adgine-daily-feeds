#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const DEFAULT_API_BASE = "https://daily.wefnews.com/api/reports/daily";

function readArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function buildUrl() {
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

function normalizeResponse(data) {
  if (data?.ok === true && data.report) {
    return {
      ok: true,
      source: "hosted_api",
      date: data.date || data.report.date || null,
      report: data.report,
      raw: data,
    };
  }

  if (["ready", "partial"].includes(data?.status) && data.report) {
    return {
      ok: true,
      source: "normalized_api",
      date: data.date || null,
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
    title: normalized.report?.title || null,
    sections: normalized.report?.sections?.map((section) => ({
      title: section.title,
      item_count: section.items?.length || 0,
    })) || [],
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
