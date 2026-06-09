#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

function readArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function requireArg(name) {
  const value = readArg(name);
  if (!value) {
    throw new Error(`Missing required argument: --${name}=...`);
  }
  return value;
}

function iterReportItems(report) {
  return (report.sections || [])
    .filter((section) => ["今日精选", "延伸阅读"].includes(section.title))
    .flatMap((section) => section.items || []);
}

function makeKey(item) {
  return `${item.title || ""}::${item.source || ""}`;
}

function normalizeResolutionItems(resolution) {
  const map = new Map();
  for (const item of resolution.items || []) {
    const href = item.href_url || item.final_url;
    if (!href || !href.startsWith("https://mp.weixin.qq.com/")) {
      continue;
    }
    map.set(makeKey(item), {
      href_url: href,
      source_url: item.source_url || item.url || null,
      status: item.status || "resolved",
    });
  }
  return map;
}

function replaceMarkdownLinks(markdown, report) {
  let updated = markdown;
  let index = 1;
  for (const section of report.sections || []) {
    if (!["今日精选", "延伸阅读"].includes(section.title)) {
      continue;
    }
    for (const item of section.items || []) {
      if (!item.href_url) {
        index += 1;
        continue;
      }
      const escapedTitle = item.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(### ${index}\\. \\[\\*\\*${escapedTitle}\\*\\*\\]\\()([^)]*)(\\))`);
      updated = updated.replace(pattern, `$1${item.href_url}$3`);
      index += 1;
    }
  }
  return updated;
}

async function main() {
  const feedPath = requireArg("feed");
  const resolutionPath = requireArg("resolution");
  const markdownPath = readArg("markdown");

  const report = JSON.parse(await readFile(feedPath, "utf8"));
  const resolution = JSON.parse(await readFile(resolutionPath, "utf8"));
  const resolutionMap = normalizeResolutionItems(resolution);

  let updatedCount = 0;
  const unresolved = [];
  for (const item of iterReportItems(report)) {
    const resolved = resolutionMap.get(makeKey(item));
    if (!resolved) {
      unresolved.push({
        title: item.title,
        source: item.source,
        url: item.url,
      });
      continue;
    }
    item.href_url = resolved.href_url;
    item.original_url_status = resolved.status;
    item.original_url_resolved_at = resolution.resolved_at || new Date().toISOString();
    updatedCount += 1;
  }

  report.original_url_resolution = {
    status: unresolved.length ? "partial" : "resolved",
    source: resolution.source || "unknown",
    resolved_at: resolution.resolved_at || new Date().toISOString(),
    updated_count: updatedCount,
    unresolved_count: unresolved.length,
    unresolved,
  };

  await writeFile(feedPath, JSON.stringify(report, null, 2) + "\n");

  if (markdownPath) {
    const markdown = await readFile(markdownPath, "utf8");
    await writeFile(markdownPath, replaceMarkdownLinks(markdown, report));
  }

  console.log(JSON.stringify({
    ok: true,
    feed: feedPath,
    markdown: markdownPath || null,
    updated_count: updatedCount,
    unresolved_count: unresolved.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error.message,
  }, null, 2));
  process.exit(1);
});
