import { connection } from "next/server";
import { SignalStatusSchema, type SignalStatus } from "@/lib/domain/schemas";
import { marketStatus } from "@/lib/market-hours";
import { kv, kvConfigured, kvPipeline } from "@/server/kv";
import { sendTelegram, telegramConfigured } from "@/server/telegram";
import { runSignalScan, signalConfigFromEnv, type SignalStore } from "@/server/workflow/signal-scan";

/** A full scan (radar + several analyses) takes minutes on free data sources. */
export const maxDuration = 300;

const LOCK_SECONDS = 290;

const kvStore: SignalStore = {
  async load(market) {
    const hash = (await kv("HGETALL", `signals:${market}`)) as string[] | null;
    const map = new Map<string, SignalStatus>();
    for (let i = 0; hash && i < hash.length; i += 2) {
      const s = SignalStatusSchema.safeParse(hash[i + 1]);
      if (s.success) map.set(hash[i], s.data);
    }
    return map;
  },
  async save(market, changes) {
    if (changes.size === 0) return;
    await kv("HSET", `signals:${market}`, ...[...changes].flat());
  },
};

/**
 * GET /api/cron/scan — server-side autopilot for a scheduler (Vercel Cron,
 * cron-job.org, GitHub Actions). Needs `Authorization: Bearer <CRON_SECRET>`.
 * Skips outside trading hours unless `?force=1`. Sends Telegram order
 * tickets only; no order is ever placed with a broker.
 */
export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return Response.json({ error: "CRON_SECRET belum diatur di server." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Tidak diizinkan." }, { status: 401 });
  if (!telegramConfigured()) return Response.json({ error: "Telegram belum dikonfigurasi." }, { status: 503 });
  if (!kvConfigured()) return Response.json({ error: "Penyimpanan belum dikonfigurasi: isi UPSTASH_REDIS_REST_URL dan UPSTASH_REDIS_REST_TOKEN." }, { status: 503 });

  const cfg = signalConfigFromEnv();
  const force = new URL(request.url).searchParams.get("force") === "1";
  const status = marketStatus(cfg.market);
  if (!status.open && !force) return Response.json({ skipped: true, reason: `Bursa ${cfg.market} ${status.label.toLowerCase()}.` });

  // Overlapping triggers (slow scan, retrying scheduler) must not send the same ticket twice.
  const lockKey = `signals:${cfg.market}:lock`;
  if ((await kv("SET", lockKey, Date.now(), "NX", "EX", LOCK_SECONDS)) !== "OK") {
    return Response.json({ skipped: true, reason: "Scan sebelumnya masih berjalan." });
  }
  const startedAt = Date.now();
  try {
    const result = await runSignalScan(cfg, kvStore, sendTelegram);
    await kvPipeline([["SET", `signals:${cfg.market}:last`, JSON.stringify({ at: startedAt, sent: result.sent.length, errors: result.errors.length })]]);
    return Response.json({ ...result, market: cfg.market, durationMs: Date.now() - startedAt });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Kesalahan tidak diketahui." }, { status: 502 });
  } finally {
    await kv("DEL", lockKey).catch(() => {});
  }
}
