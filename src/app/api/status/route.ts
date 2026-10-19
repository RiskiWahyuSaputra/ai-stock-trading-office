import { connection } from "next/server";
import { getMarketProvider, getNewsProvider } from "@/server/providers";

/** GET /api/status — which data providers are active (no secrets exposed). */
export async function GET() {
  await connection();
  const market = getMarketProvider();
  const news = getNewsProvider();
  return Response.json({
    market: market.source,
    news: news.source,
    supportsLivePrices: market.supportsLivePrices,
    llm: { enabled: false, note: "Analisis memakai aturan deterministik; integrasi LLM belum dikonfigurasi." },
    serverTime: Date.now(),
  });
}
