import "server-only";
import { kvConfigured } from "./kv";

/**
 * Outgoing Telegram notifications via the Bot API. Token and chat id are read
 * from server env vars only; the browser never sees them.
 */
const token = () => process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
const chatId = () => process.env.TELEGRAM_CHAT_ID?.trim() || null;

export function telegramConfigured() {
  return token() !== null && chatId() !== null;
}

/** The scheduled server scan (`/api/cron/scan`) can run: it then owns the autopilot tickets. */
export function serverSignalsConfigured() {
  return telegramConfigured() && !!process.env.CRON_SECRET?.trim() && kvConfigured();
}

export class TelegramError extends Error {}

export async function sendTelegram(text: string) {
  const t = token();
  const chat = chatId();
  if (!t || !chat) throw new TelegramError("Telegram belum dikonfigurasi: isi TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID di .env.local.");
  const res = await fetch(`https://api.telegram.org/bot${t}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { description?: string };
    throw new TelegramError(`Telegram menolak pesan: ${body.description ?? `HTTP ${res.status}`}`);
  }
}
