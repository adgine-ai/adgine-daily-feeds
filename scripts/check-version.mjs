#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const SKILL_ROOT = new URL("../", import.meta.url);
const VERSION_FILE = new URL("VERSION", SKILL_ROOT);
const SKILL_FILE = new URL("SKILL.md", SKILL_ROOT);

function readArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function normalizeVersion(value) {
  const match = String(value || "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return null;
  }
  return {
    raw: `v${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`,
    parts: [Number(match[1]), Number(match[2]), Number(match[3])],
  };
}

function compareVersions(a, b) {
  for (let index = 0; index < 3; index += 1) {
    if (a.parts[index] > b.parts[index]) {
      return 1;
    }
    if (a.parts[index] < b.parts[index]) {
      return -1;
    }
  }
  return 0;
}

function parseSkillVersion(skillMarkdown) {
  const frontmatter = skillMarkdown.match(/^---\n([\s\S]*?)\n---/);
  const frontmatterVersion = frontmatter?.[1].match(/^version:\s*(.+)$/m)?.[1]?.trim() || null;
  const bodyVersion = skillMarkdown.match(/^Version:\s*`?([^`\n]+)`?/m)?.[1]?.trim() || null;
  return {
    frontmatter_version: frontmatterVersion,
    body_version: bodyVersion,
  };
}

async function main() {
  const versionText = (await readFile(VERSION_FILE, "utf8")).trim();
  const skillMarkdown = await readFile(SKILL_FILE, "utf8");
  const skillVersions = parseSkillVersion(skillMarkdown);
  const current = normalizeVersion(versionText);
  const frontmatter = normalizeVersion(skillVersions.frontmatter_version);
  const body = normalizeVersion(skillVersions.body_version);
  const latestInput = readArg("latest") || process.env.ADGINE_DAILY_FEEDS_LATEST_VERSION || null;
  const latest = latestInput ? normalizeVersion(latestInput) : null;

  if (!current) {
    throw new Error(`Invalid VERSION value: ${versionText}`);
  }
  if (latestInput && !latest) {
    throw new Error(`Invalid latest version: ${latestInput}`);
  }

  const mismatches = [];
  if (!frontmatter || frontmatter.raw !== current.raw) {
    mismatches.push({
      field: "SKILL.md frontmatter version",
      value: skillVersions.frontmatter_version,
      expected: current.raw,
    });
  }
  if (!body || body.raw !== current.raw) {
    mismatches.push({
      field: "SKILL.md body Version",
      value: skillVersions.body_version,
      expected: current.raw,
    });
  }

  const isOutdated = latest ? compareVersions(current, latest) < 0 : false;
  const result = {
    ok: mismatches.length === 0,
    skill: "adgine-daily-feeds",
    current_version: current.raw,
    latest_version: latest?.raw || null,
    is_outdated: isOutdated,
    mismatches,
    recommendation: isOutdated
      ? `当前版本 ${current.raw} 低于 ${latest.raw}。请手动更新 skill 后再运行生产任务。`
      : mismatches.length
        ? "版本字段不一致，请先同步 VERSION 与 SKILL.md。"
        : "当前本地版本字段一致；未发现需要更新的版本信号。",
  };

  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    skill: "adgine-daily-feeds",
    error: error.message,
  }, null, 2));
  process.exit(1);
});
