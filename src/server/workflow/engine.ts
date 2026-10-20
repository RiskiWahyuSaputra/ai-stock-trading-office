import "server-only";
import { buildFinalReport } from "@/lib/agents/final-officer";
import { runNewsResearch } from "@/lib/agents/news-researcher";
import { runRiskCheck } from "@/lib/agents/risk-manager";
import { runReview } from "@/lib/agents/signal-reviewer";
import { runTechnicalAnalysis } from "@/lib/agents/technical-analyst";
import { AGENT_ORDER } from "@/lib/domain/agents";
import type {
  AgentId,
  AgentStatus,
  AnalysisRequest,
  CandleSeries,
  NewsReport,
  Quote,
  RiskReport,
  TechnicalReport,
  WorkflowEvent,
} from "@/lib/domain/schemas";
import { getMarketProvider, getNewsProvider, SymbolNotFoundError } from "@/server/providers";

const CANDLES = 250;
const CANDLES_RECHECK = 400;

/**
 * Agent workflow. Each yielded event corresponds to work that has actually
 * started or finished on the server — the office animation is driven by
 * these events, never by timers.
 */
export async function* runAnalysisWorkflow(request: AnalysisRequest): AsyncGenerator<WorkflowEvent> {
  const runId = crypto.randomUUID();
  const market = getMarketProvider();
  const newsProvider = getNewsProvider();
  let current: AgentId | null = null;
  const { mode, market: mkt, accountSize, riskPct } = request;
  const riskParams = { mode, market: mkt, accountSize, riskPct };

  const status = (agent: AgentId, s: AgentStatus, progress: number, message: string): WorkflowEvent => {
    current = agent;
    return { type: "agent_status", runId, agent, status: s, progress, message, at: Date.now() };
  };

  /** One agent passing its finished output to the next — real data, real order. */
  const handoff = (from: AgentId, to: AgentId, message: string): WorkflowEvent => ({ type: "handoff", runId, from, to, message, at: Date.now() });

  yield { type: "run_started", runId, request, at: Date.now() };
  for (const a of AGENT_ORDER) yield status(a, "queued", 0, `Menunggu giliran untuk ${request.symbol}.`);

  try {
    const stock = await market.getStock(request.symbol, request.market);
    if (!stock) throw new SymbolNotFoundError(`${request.symbol} (${request.market})`);

    // 1. News Researcher
    yield status("news", "researching", 10, `Mengambil berita ${request.symbol} dari ${newsProvider.source.name}.`);
    const items = await newsProvider.getNews(request.symbol, 8, request.market);
    yield status("news", "researching", 60, `${items.length} berita diterima, mengklasifikasi sentimen.`);
    const news: NewsReport = runNewsResearch(items, newsProvider.source);
    yield status("news", "completed", 100, news.summary);
    yield handoff(
      "news",
      "reviewer",
      `Sentimen ${news.sentiment} (${news.sentimentScore >= 0 ? "+" : ""}${news.sentimentScore.toFixed(2)}), ${news.catalysts.length} katalis, ${news.risks.length} risiko berita.`,
    );

    // 2. Technical Analyst
    yield status("technical", "analyzing", 10, `Mengambil ${CANDLES} candle ${request.timeframe} dan harga terakhir.`);
    let [series, quote]: [CandleSeries, Quote] = await Promise.all([
      market.getCandles(request.symbol, request.timeframe, CANDLES, request.market),
      market.getQuote(request.symbol, request.market),
    ]);
    const delay = quote.delayMinutes ? `, delay bursa ${quote.delayMinutes} menit` : "";
    yield status("technical", "analyzing", 55, `Menghitung indikator dari ${series.candles.length} candle (${series.source.name}${delay}).`);
    let technical: TechnicalReport = runTechnicalAnalysis(series, request.market, request.mode);
    yield status("technical", "completed", 100, technicalSummary(technical));
    yield handoff("technical", "risk", technicalSummary(technical));

    // 3. Risk Manager
    yield status("risk", "risk_checking", 30, "Memeriksa konsistensi level dan menghitung risk/reward.");
    let risk: RiskReport = runRiskCheck({ technical, candles: series.candles, quote, ...riskParams });
    yield status(
      "risk",
      risk.status === "eligible" ? "completed" : "needs_attention",
      100,
      riskSummary(risk),
    );
    yield handoff("risk", "reviewer", riskSummary(risk));

    // 4. Signal Reviewer (may return work to the Technical Analyst once)
    yield status("reviewer", "reviewing", 30, "Membandingkan laporan berita, teknikal, dan risiko.");
    let review = runReview({ news, technical, risk, quote });
    if (review.returnedTo.includes("technical")) {
      yield status("reviewer", "needs_attention", 50, "Data teknikal belum memadai — dikembalikan ke Technical Analyst.");
      yield handoff("reviewer", "technical", `Tolong ulangi dengan ${CANDLES_RECHECK} candle: ${review.checks.filter((c) => !c.passed).map((c) => c.label).join(", ")}.`);
      yield status("technical", "analyzing", 20, `Pemeriksaan ulang dengan ${CANDLES_RECHECK} candle.`);
      [series, quote] = await Promise.all([
        market.getCandles(request.symbol, request.timeframe, CANDLES_RECHECK, request.market),
        market.getQuote(request.symbol, request.market),
      ]);
      technical = runTechnicalAnalysis(series, request.market, request.mode);
      yield status("technical", "completed", 100, `Ulang: ${technicalSummary(technical)}`);
      yield status("risk", "risk_checking", 50, "Menghitung ulang risiko dari hasil teknikal baru.");
      risk = runRiskCheck({ technical, candles: series.candles, quote, ...riskParams });
      yield status("risk", risk.status === "eligible" ? "completed" : "needs_attention", 100, riskSummary(risk));
      yield status("reviewer", "reviewing", 70, "Meninjau ulang hasil revisi.");
      review = runReview({ news, technical, risk, quote });
    }
    yield status(
      "reviewer",
      review.verdict === "approved" ? "completed" : "needs_attention",
      100,
      `Hasil review: ${review.verdict.replace("_", " ")}${review.conflicts.length ? ` — ${review.conflicts[0].replace(/\.$/, "")}` : ""}.`,
    );

    yield handoff("reviewer", "officer", `Verdict ${review.verdict.replace("_", " ")}; ${review.checks.filter((c) => c.passed).length}/${review.checks.length} pemeriksaan lolos.`);

    // 5. Final Signal Officer
    yield status("officer", "finalizing", 50, "Menyusun laporan final.");
    const report = buildFinalReport({ id: runId, request, quote, news, technical, risk, review });
    yield status("officer", "completed", 100, `Laporan final: ${report.status.replace("_", " ")} untuk ${request.symbol}.`);
    yield { type: "run_completed", runId, report, at: Date.now() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kesalahan tidak diketahui.";
    if (current) yield status(current, "failed", 100, message);
    yield { type: "run_failed", runId, agent: current, error: message, at: Date.now() };
  }
}

function technicalSummary(t: TechnicalReport) {
  const dir = { bullish: "Bullish", bearish: "Bearish", neutral: "Netral" }[t.direction];
  const levels = t.entryZone ? ` Entry ${t.entryZone.low}–${t.entryZone.high}, SL ${t.stopLoss}.` : "";
  return `Tren ${dir} (skor ${t.trendScore.toFixed(2)}) pada ${t.timeframe}.${levels}`;
}

function riskSummary(r: RiskReport) {
  const rr = r.riskReward.length ? ` R/R ${r.riskReward.map((x) => x.toFixed(2)).join(" / ")}.` : "";
  const issue = r.issues[0] ? ` ${r.issues[0]}` : "";
  return `Status ${r.status}.${rr}${issue}`;
}
