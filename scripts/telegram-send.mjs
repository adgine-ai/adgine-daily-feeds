#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

const SKILL_ROOT = new URL("../", import.meta.url);
const DEFAULT_CONFIG_PATH = new URL("config/destinations.local.json", SKILL_ROOT);
const FALLBACK_CONFIG_PATH = new URL("config/destinations.json", SKILL_ROOT);
const TELEGRAM_LIMIT = 3900;

function readArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

async function readJsonIfExists(fileUrl) {
  try {
    return JSON.parse(await readFile(fileUrl, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function readDeliveryConfig() {
  const localConfig = await readJsonIfExists(DEFAULT_CONFIG_PATH);
  if (localConfig) {
    return localConfig;
  }
  const fallbackConfig = await readJsonIfExists(FALLBACK_CONFIG_PATH);
  return fallbackConfig || {};
}

function getTelegramConfig(config) {
  return config.destinations?.telegram || config.telegram || {};
}

function requireConfig(config, envName, configName) {
  const value = process.env[envName] || readArg(configName.replaceAll("_", "-")) || config[configName];
  if (!value) {
    throw new Error(`Missing required config: ${envName}, --${configName.replaceAll("_", "-")}=..., or config/destinations.local.json:destinations.telegram.${configName}`);
  }
  return value;
}

async function telegramRequest(botToken, method, body = null) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(`Telegram API failed: ${response.status} ${data.description || ""}`.trim());
  }
  return data;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function splitPublishedLabel(label = "") {
  const [publishedAt, quality] = label.split("｜");
  return {
    publishedAt: (publishedAt || "").trim(),
    quality: (quality || "").trim(),
  };
}

function canLink(url) {
  return /^https?:\/\//.test(url || "");
}

function linkedTitle(index, item) {
  const title = escapeHtml(item.title || "Untitled");
  const href = item.href_url || item.url;
  if (canLink(href)) {
    return `${index}. <a href="${escapeHtml(href)}">${title}</a>`;
  }
  return `${index}. <b>${title}</b>`;
}

function buildUserDailyHtml(report) {
  const lines = [];
  lines.push(`<b>${escapeHtml(report.title || "CIO Daily 日报")}</b>`);
  lines.push("");
  lines.push(escapeHtml([report.display_scope, report.display_captured_at].filter(Boolean).join(" ｜ ")));

  let itemIndex = 1;
  for (const section of report.sections || []) {
    if (section.title === "今日结论") {
      const conclusion = section.items?.[0];
      if (conclusion) {
        lines.push("");
        lines.push(`<b>${escapeHtml(section.title)} ： ${escapeHtml(conclusion.title || "")}</b>`);
        for (const bullet of conclusion.bullets || []) {
          lines.push(`- ${escapeHtml(bullet)}`);
        }
      }
      continue;
    }

    lines.push("");
    lines.push(`<b>${escapeHtml(section.title)}</b>`);
    lines.push("");

    for (const item of section.items || []) {
      const { publishedAt, quality } = splitPublishedLabel(item.published_label);
      lines.push(linkedTitle(itemIndex, item));
      lines.push(`- 来源：${escapeHtml([item.source || "n/a", publishedAt].filter(Boolean).join(" ｜ "))}`);
      if (quality) {
        lines.push(`- 指数：${escapeHtml(quality)}`);
      }
      if (item.ai_recommendation) {
        lines.push(`- 推荐：${escapeHtml(item.ai_recommendation)}`);
      }
      lines.push("");
      itemIndex += 1;
    }
  }

  if (report.footer) {
    lines.push("");
    lines.push(escapeHtml(report.footer));
  }
  return lines.join("\n");
}

function splitMessages(html) {
  const chunks = [];
  let current = "";
  for (const block of html.split(/\n\n/)) {
    const next = current ? `${current}\n\n${block}` : block;
    if (next.length > TELEGRAM_LIMIT && current) {
      chunks.push(current);
      current = block;
    } else {
      current = next;
    }
  }
  if (current) {
    chunks.push(current);
  }
  return chunks;
}

async function listUpdates(botToken) {
  const data = await telegramRequest(botToken, "getUpdates");
  return (data.result || []).map((update) => {
    const message = update.message || update.channel_post || update.my_chat_member || {};
    const chat = message.chat || {};
    return {
      update_id: update.update_id,
      chat_id: chat.id,
      chat_type: chat.type,
      chat_title: chat.title || null,
      username: chat.username || null,
      text: message.text || null,
      date: message.date || null,
    };
  });
}

async function sendReport(botToken, chatId, report) {
  const chunks = splitMessages(buildUserDailyHtml(report));
  const responses = [];
  for (const [index, chunk] of chunks.entries()) {
    const data = await telegramRequest(botToken, "sendMessage", {
      chat_id: chatId,
      text: chunks.length > 1 ? `${chunk}\n\n(${index + 1}/${chunks.length})` : chunk,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    responses.push({
      message_id: data.result?.message_id,
      chat_id: data.result?.chat?.id,
    });
  }
  return responses;
}

async function main() {
  const deliveryConfig = await readDeliveryConfig();
  const telegramConfig = getTelegramConfig(deliveryConfig);
  const botToken = requireConfig(telegramConfig, "TELEGRAM_BOT_TOKEN", "bot_token");

  if (hasFlag("list-updates")) {
    const updates = await listUpdates(botToken);
    console.log(JSON.stringify({
      ok: true,
      updates,
      note: updates.length ? "Use chat_id from the target chat." : "No updates yet. Send a message to the bot or add it to the target chat, then run again.",
    }, null, 2));
    return;
  }

  const postJsonPath = readArg("post-json");
  if (!postJsonPath) {
    throw new Error("Missing --post-json=<path>. Use --list-updates to find chat_id.");
  }

  const chatId = process.env.TELEGRAM_CHAT_ID || readArg("chat-id") || telegramConfig.chat_id;
  if (!chatId) {
    throw new Error("Missing TELEGRAM_CHAT_ID, --chat-id=..., or config/destinations.local.json:destinations.telegram.chat_id");
  }

  const report = JSON.parse(await readFile(postJsonPath, "utf8"));
  const responses = await sendReport(botToken, chatId, report);
  const logPath = readArg("log");
  const result = {
    ok: true,
    provider: "telegram",
    post_json: postJsonPath,
    chat_id: chatId,
    sent_count: responses.length,
    messages: responses,
    sent_at: new Date().toISOString(),
  };
  if (logPath) {
    await writeFile(logPath, JSON.stringify(result, null, 2) + "\n");
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    provider: "telegram",
    error: error.message,
  }, null, 2));
  process.exit(1);
});
