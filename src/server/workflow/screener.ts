import "server-only";
import { IMPROVING_SCORE, planEntry } from "@/lib/agents/entry-planner";
import { buildFinalReport } from "@/lib/agents/final-officer";
import { runNewsResearch } from "@/lib/agents/news-researcher";
import { runRiskCheck } from "@/lib/agents/risk-manager";
import { runReview } from "@/lib/agents/signal-reviewer";
import { runTechnicalAnalysis } from "@/lib/agents/technical-analyst";
import type { AnalysisRequest, NewsReport, Quote, ScreenEvent, ScreenItem, ScreenRequest } from "@/lib/domain/schemas";
import { entryWindow, type EntryWindow } from "@/lib/market-hours";
import { getMarketProvider, getNewsProvider } from "@/server/providers";

const CANDLES = 250;
/** Parallel symbols per step; keeps an unofficial endpoint from rate-limiting us. */
const CONCURRENCY = 5;

/**
 * Entry Radar. Runs the same agents as a single analysis on every symbol of
 * the universe (daily timeframe), then the Entry Planner decides whether a
 * buy entry fits today, the next session, later, or not at all.
 * News is fetched only for charts that could become a buy, so the scan stays
 * within what free data sources tolerate.
 */
export async function* runScreener(request: ScreenRequest): AsyncGenerator<ScreenEvent> {
  const scanId = crypto.randomUUID();
  const market = getMarketProvider();
  const newsProvider = getNewsProvider();
  const universe = request.symbols ?? market.listUniverse(request.market).map((s) => s.symbol);
  const symbols = [...new Set(universe)];
  const window = entryWindow(request.market);
  const total = symbols.length;

  yield {
    type: "scan_started",
    scanId,
    request,
    total,
    today: window.today,
    nextDay: window.nextDay,
    sessionLabel: window.label,
    at: Date.now(),
  };

  try {
    const quotes = new Map((await market.getQuotes(symbols, request.market)).map((q) => [q.stock.symbol, q]));
    let done = 0;
    for (let i = 0; i < symbols.length; i += CONCURRENCY) {
      const chunk = symbols.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(chunk.map((s) => screenSymbol(s, quotes.get(s), request, window)));
      for (const [j, r] of results.entries()) {
        done++;
        if (r.status === "fulfilled") yield { type: "scan_item", scanId, done, total, item: r.value, at: Date.now() };
        else {
          const error = r.reason instanceof Error ? r.reason.message : "Kesalahan tidak diketahui.";
          yield { type: "scan_error", scanId, done, total, symbol: chunk[j], error, at: Date.now() };
        }
      }
    }
    yield { type: "scan_completed", scanId, sources: [market.source, newsProvider.source], at: Date.now() };
  } catch (err) {
    yield { type: "scan_failed", scanId, error: err instanceof Error ? err.message : "Kesalahan tidak diketahui.", at: Date.now() };
  }
}

async function screenSymbol(symbol: string, quote: Quote | undefined, req: ScreenRequest, window: EntryWindow): Promise<ScreenItem> {
  if (!quote) throw new Error(`Harga terakhir ${symbol} tidak tersedia dari sumber data.`);
  const market = getMarketProvider();
  const newsProvider = getNewsProvider();
  const request: AnalysisRequest = {
    symbol,
    market: req.market,
    timeframe: "1D",
    mode: req.mode,
    accountSize: req.accountSize,
    riskPct: req.riskPct,
  };

  const series = await market.getCandles(symbol, "1D", CANDLES, req.market);
  const technical = runTechnicalAnalysis(series, req.market, req.mode);
  const candidate = technical.direction === "bullish" || technical.trendScore >= IMPROVING_SCORE;
  const news: NewsReport = candidate
    ? runNewsResearch(await newsProvider.getNews(symbol, 8, req.market), newsProvider.source)
    : { ...runNewsResearch([], newsProvider.source), summary: "Berita tidak diambil: grafik bukan kandidat beli." };
  const risk = runRiskCheck({ technical, candles: series.candles, quote, mode: req.mode, market: req.market, accountSize: req.accountSize, riskPct: req.riskPct });
  const review = runReview({ news, technical, risk, quote });
  const report = buildFinalReport({ id: crypto.randomUUID(), request, quote, news, technical, risk, review });
  const plan = planEntry(report, window);

  return {
    stock: quote.stock,
    lastPrice: quote.lastPrice,
    changePct: quote.changePct,
    status: report.status,
    direction: technical.direction,
    trendScore: technical.trendScore,
    confidence: report.confidence.score,
    plan,
    report: plan.timing === "avoid" ? undefined : report,
  };
}
