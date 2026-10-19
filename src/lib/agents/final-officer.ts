import { DISCLAIMER } from "@/lib/domain/agents";
import { HIGH_GAP_PCT, HIGH_VOL_PCT } from "./risk-manager";
import type {
  AnalysisRequest,
  Confidence,
  FinalReport,
  NewsReport,
  Quote,
  ReviewReport,
  RiskReport,
  SignalStatus,
  TechnicalReport,
} from "@/lib/domain/schemas";

export function decideStatus(technical: TechnicalReport, risk: RiskReport, review: ReviewReport): SignalStatus {
  if (review.verdict === "insufficient_data" || risk.status === "rejected") return "NO_TRADE";
  if (review.verdict !== "approved") return "WAIT";
  if (technical.direction === "bullish") return "BUY_SETUP";
  if (technical.direction === "bearish") return "SELL_SETUP";
  return "WAIT";
}

/**
 * Confidence is a confluence score (how many independent checks agree), not
 * a probability of profit. The explanation says so explicitly.
 */
export function scoreConfidence(
  technical: TechnicalReport,
  news: NewsReport,
  risk: RiskReport,
  review: ReviewReport,
): Confidence {
  const factors: Confidence["factors"] = [];
  const f = (label: string, impact: number) => factors.push({ label, impact: Math.round(impact) });

  f("Kekuatan tren teknikal", Math.abs(technical.trendScore) * 35);
  if (technical.direction !== "neutral") {
    const aligned =
      (technical.direction === "bullish" && news.sentimentScore > 0.15) ||
      (technical.direction === "bearish" && news.sentimentScore < -0.15);
    if (aligned) f("Sentimen berita searah", 15);
    else if (review.conflicts.length) f("Konflik berita vs teknikal", -20);
    else f("Sentimen berita netral", 0);
  }
  const mainRR = risk.riskReward[1] ?? risk.riskReward[0];
  if (mainRR !== undefined) f(`R/R target utama ${mainRR.toFixed(2)}`, mainRR >= risk.minRiskReward ? 15 : -10);
  if (risk.volatilityPct !== null && risk.volatilityPct > HIGH_VOL_PCT[technical.timeframe]) f("Volatilitas tinggi", -10);
  if (risk.maxGapPct !== null && risk.maxGapPct > HIGH_GAP_PCT[technical.timeframe]) f("Riwayat gap besar", -5);
  const failed = review.checks.filter((c) => !c.passed).length;
  if (failed) f(`${failed} pemeriksaan reviewer gagal`, -8 * failed);

  // Capped at 90: no combination of checks justifies presenting near-certainty.
  const score = Math.max(0, Math.min(90, 35 + factors.reduce((s, x) => s + x.impact, 0)));
  const label = score >= 70 ? "high" : score >= 45 ? "moderate" : "low";
  return {
    score,
    label,
    factors,
    explanation:
      "Skor konfluensi 0–100: seberapa banyak pemeriksaan independen (tren, berita, R/R, volatilitas, review) yang saling mendukung. " +
      "Ini BUKAN probabilitas profit atau tingkat akurasi.",
  };
}

export function buildFinalReport(params: {
  id: string;
  request: AnalysisRequest;
  quote: Quote;
  news: NewsReport;
  technical: TechnicalReport;
  risk: RiskReport;
  review: ReviewReport;
  now?: number;
}): FinalReport {
  const { id, request, quote, news, technical, risk, review } = params;
  const status = decideStatus(technical, risk, review);
  const actionable = status === "BUY_SETUP" || status === "SELL_SETUP";
  const confidence = scoreConfidence(technical, news, risk, review);

  const reasons = [
    ...technical.reasons.slice(0, 5),
    `Berita: ${news.summary}`,
    `Risk Manager: status ${risk.status}${risk.riskReward.length ? `, R/R ${risk.riskReward.join(" / ")}` : ""}.`,
    `Reviewer: ${review.verdict.replace("_", " ")}.`,
  ];

  const mainRisks = [...risk.issues, ...review.conflicts, ...news.risks.slice(0, 3)];
  if (mainRisks.length === 0) mainRisks.push("Pergerakan pasar dapat berbalik sewaktu-waktu meski seluruh pemeriksaan lolos.");

  const invalidation: string[] = [];
  if (technical.invalidationLevel !== null) {
    invalidation.push(
      technical.direction === "bullish"
        ? `Close ${technical.timeframe} di bawah ${technical.invalidationLevel} membatalkan skenario.`
        : `Close ${technical.timeframe} di atas ${technical.invalidationLevel} membatalkan skenario.`,
    );
  }
  invalidation.push("Berita material baru yang berlawanan dengan arah skenario.");
  if (risk.volatilityPct !== null) invalidation.push(`Lonjakan volatilitas jauh di atas ${risk.volatilityPct.toFixed(2)}% per bar.`);

  let alternativeScenario: string;
  if (technical.direction === "bullish") {
    alternativeScenario = `Jika support ${technical.supports[0] ?? technical.invalidationLevel ?? "-"} ditembus, tren berpotensi berubah menjadi koreksi; tunggu struktur baru.`;
  } else if (technical.direction === "bearish") {
    alternativeScenario = `Jika resistance ${technical.resistances[0] ?? technical.invalidationLevel ?? "-"} ditembus ke atas, tekanan jual melemah; evaluasi ulang.`;
  } else {
    alternativeScenario = "Tunggu breakout dari range dengan konfirmasi volume sebelum menyusun skenario.";
  }

  const sources = [quote.source, technical.source, news.source].filter(
    (s, i, arr) => arr.findIndex((x) => x.id === s.id) === i,
  );

  return {
    id,
    request,
    quote,
    status,
    direction: technical.direction,
    entryZone: actionable ? technical.entryZone : null,
    stopLoss: actionable ? technical.stopLoss : null,
    takeProfits: actionable ? technical.takeProfits : [],
    riskReward: actionable ? risk.riskReward : [],
    confidence,
    reasons,
    mainRisks,
    invalidation,
    alternativeScenario,
    news,
    technical,
    risk,
    review,
    sources,
    isDemo: sources.some((s) => s.isDemo),
    createdAt: params.now ?? Date.now(),
    disclaimer: DISCLAIMER,
  };
}
