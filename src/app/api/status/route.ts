import { connection } from "next/server";
import { getMarketProvider, getNewsProvider } from "@/server/providers";
import { kv } from "@/server/kv";
import { serverSignalsConfigured, telegramConfigured } from "@/server/telegram";
import { signalConfigFromEnv } from "@/server/workflow/signal-scan";

/** GET /api/status — which data providers are active (no secrets exposed). */
export async function GET() {
  await connection();
  const market = getMarketProvider();
  const news = getNewsProvider();
  const server = serverSignalsConfigured();
  let lastScan: { at: number; sent: number; errors: number } | null = null;
  if (server) {
    const raw = await kv("GET", `signals:${signalConfigFromEnv().market}:last`).catch(() => null);
    lastScan = typeof raw === "string" ? JSON.parse(raw) : null;
  }
  return Response.json({
    market: market.source,
    news: news.source,
    supportsLivePrices: market.supportsLivePrices,
    llm: { enabled: false, note: "Analisis memakai aturan deterministik; integrasi LLM belum dikonfigurasi." },
    telegram: { enabled: telegramConfigured(), server, lastScan },
    serverTime: Date.now(),
  });
}
