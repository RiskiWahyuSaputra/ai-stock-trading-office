import { validateLevels } from "@/lib/analysis/risk";
import type { AgentId, NewsReport, Quote, ReviewReport, ReviewVerdict, RiskReport, TechnicalReport, Timeframe } from "@/lib/domain/schemas";
import { MIN_CANDLES } from "./technical-analyst";

/** Max age of the last candle before data is considered stale. */
export const MAX_DATA_AGE_MS: Record<Timeframe, number> = {
  "1h": 3 * 3_600_000,
  "4h": 12 * 3_600_000,
  "1D": 4 * 86_400_000,
  "1W": 14 * 86_400_000,
};
export const MAX_QUOTE_AGE_MS = 30 * 60_000;
export const CONFLICT_THRESHOLD = 0.35;

/**
 * Signal Reviewer — cross-checks agents. `returnedTo` lists agents whose work
 * must be redone; the workflow engine re-runs them once before finalising.
 */
export function runReview(params: {
  news: NewsReport;
  technical: TechnicalReport;
  risk: RiskReport;
  quote: Quote;
  now?: number;
}): ReviewReport {
  const { news, technical, risk, quote } = params;
  const now = params.now ?? Date.now();
  const checks: ReviewReport["checks"] = [];
  const conflicts: string[] = [];
  const returnedTo = new Set<AgentId>();
  const check = (label: string, passed: boolean, detail: string) => checks.push({ label, passed, detail });

  const enoughCandles = technical.candlesUsed >= MIN_CANDLES;
  check("Kelengkapan data harga", enoughCandles, `${technical.candlesUsed} candle (${technical.timeframe}), minimum ${MIN_CANDLES}.`);
  if (!enoughCandles) returnedTo.add("technical");

  const candleAge = now - technical.dataTimestamp;
  const freshCandles = candleAge <= MAX_DATA_AGE_MS[technical.timeframe];
  check("Kesegaran data candle", freshCandles, `Candle terakhir ${formatAge(candleAge)} lalu.`);
  if (!freshCandles) returnedTo.add("technical");

  const quoteAge = now - quote.timestamp;
  const freshQuote = quoteAge <= MAX_QUOTE_AGE_MS;
  check("Kesegaran harga terakhir", freshQuote, `Quote ${formatAge(quoteAge)} lalu dari ${quote.source.name}.`);

  check("Ketersediaan berita", news.items.length > 0, `${news.items.length} berita dari ${news.source.name}.`);

  const demo = quote.source.isDemo || technical.source.isDemo || news.source.isDemo;
  check("Sumber data", true, demo ? "Menggunakan data DEMO (simulasi), bukan data pasar nyata." : "Sumber data live.");

  if (technical.direction !== "neutral") {
    const s = news.sentimentScore;
    const opposed =
      (technical.direction === "bullish" && s <= -CONFLICT_THRESHOLD) ||
      (technical.direction === "bearish" && s >= CONFLICT_THRESHOLD);
    check(
      "Sentimen berita vs tren teknikal",
      !opposed,
      `Tren ${technical.direction}, sentimen ${news.sentiment} (${s.toFixed(2)}).`,
    );
    if (opposed) conflicts.push(`Tren teknikal ${technical.direction} bertentangan dengan sentimen berita ${news.sentiment}.`);

    if (technical.entryZone && technical.stopLoss !== null) {
      const lv = validateLevels(
        technical.direction === "bullish" ? "long" : "short",
        technical.entryZone,
        technical.stopLoss,
        technical.takeProfits,
      );
      check("Konsistensi entry/SL/TP", lv.valid, lv.valid ? "Urutan level konsisten." : lv.issues.join(" "));
      if (!lv.valid) returnedTo.add("technical");
    }
    const rrOk = risk.riskReward.length > 0 && risk.status !== "rejected";
    check(
      "Risk/reward memenuhi aturan",
      rrOk,
      risk.riskReward.length ? `R/R ${risk.riskReward.map((r) => r.toFixed(2)).join(" / ")}, minimum ${risk.minRiskReward}.` : "R/R tidak tersedia.",
    );
  } else {
    check("Arah tren", false, "Technical Analyst tidak menemukan arah yang jelas.");
  }

  let verdict: ReviewVerdict;
  if (!enoughCandles || !freshCandles || !freshQuote) verdict = "insufficient_data";
  else if (conflicts.length > 0) verdict = "conflicting";
  else if (technical.direction === "neutral" || risk.status !== "eligible") verdict = "needs_review";
  else verdict = checks.every((c) => c.passed) ? "approved" : "needs_review";

  return { verdict, checks, conflicts, returnedTo: [...returnedTo], completedAt: now };
}

function formatAge(ms: number) {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m} menit`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} jam`;
  return `${Math.round(h / 24)} hari`;
}
