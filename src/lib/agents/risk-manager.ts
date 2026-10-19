import { maxGapPct, positionSize, riskReward, validateLevels, zoneMid } from "@/lib/analysis/risk";
import type { AnalysisMode, Candle, Market, Quote, RiskReport, RiskStatus, TechnicalReport, Timeframe } from "@/lib/domain/schemas";

export const MIN_RR: Record<AnalysisMode, number> = { conservative: 2, balanced: 1.5, aggressive: 1.2 };
/** ATR/price (%) per bar above which volatility is flagged, by timeframe. */
export const HIGH_VOL_PCT: Record<Timeframe, number> = { "1h": 1.5, "4h": 2.5, "1D": 4, "1W": 8 };
/** Largest open-vs-prev-close gap (%) above which gap risk is flagged. */
export const HIGH_GAP_PCT: Record<Timeframe, number> = { "1h": 2, "4h": 3, "1D": 4, "1W": 6 };

export const DEFAULT_ACCOUNT: Record<Market, number> = { IDX: 100_000_000, US: 10_000 };
export const DEFAULT_RISK_PCT = 1;

/**
 * Risk Manager — all numbers come from `@/lib/analysis/risk`.
 * The main target for the R/R rule is TP2; TP1 must be at least 1R.
 */
export function runRiskCheck(params: {
  technical: TechnicalReport;
  candles: Candle[];
  quote: Quote;
  mode: AnalysisMode;
  market: Market;
  accountSize?: number;
  riskPct?: number;
  now?: number;
}): RiskReport {
  const { technical, candles, quote, mode, market } = params;
  const now = params.now ?? Date.now();
  const minRiskReward = MIN_RR[mode];
  const issues: string[] = [];
  const notes: string[] = [];

  const atrV = technical.indicators.atr14;
  const volatilityPct = atrV !== null ? Math.round((atrV / technical.lastClose) * 10000) / 100 : null;
  const gap = candles.length > 1 ? maxGapPct(candles.slice(-60)) : null;

  if (volatilityPct !== null) {
    notes.push(`Volatilitas (ATR/harga) ${volatilityPct.toFixed(2)}% per bar.`);
    const lim = HIGH_VOL_PCT[technical.timeframe];
    if (volatilityPct > lim) issues.push(`Volatilitas tinggi (>${lim}% per bar ${technical.timeframe}): stop loss rawan tersentuh noise.`);
  }
  if (gap !== null) {
    notes.push(`Gap terbesar 60 bar terakhir ${gap.toFixed(2)}%.`);
    if (gap > HIGH_GAP_PCT[technical.timeframe]) issues.push(`Riwayat gap besar (${gap.toFixed(2)}%): harga bisa melompati stop loss.`);
  }
  if (market === "IDX" && technical.direction === "bearish") {
    notes.push("Pasar IDX: short selling ritel terbatas. SELL SETUP dibaca sebagai sinyal keluar/hindari posisi beli.");
  }

  const base = { minRiskReward, volatilityPct, maxGapPct: gap, notes, completedAt: now };

  if (technical.direction === "neutral" || !technical.entryZone || technical.stopLoss === null) {
    issues.unshift("Tidak ada skenario entry dari Technical Analyst untuk diperiksa.");
    return { ...base, status: "caution", riskPerShare: null, rewardPerShare: [], riskReward: [], position: null, issues };
  }

  const side = technical.direction === "bullish" ? "long" : "short";
  const check = validateLevels(side, technical.entryZone, technical.stopLoss, technical.takeProfits);
  if (!check.valid) {
    return {
      ...base,
      status: "rejected",
      riskPerShare: null,
      rewardPerShare: [],
      riskReward: [],
      position: null,
      issues: [...check.issues, ...issues],
    };
  }

  const rr = riskReward(side, technical.entryZone, technical.stopLoss, technical.takeProfits);
  const mid = zoneMid(technical.entryZone);
  // Price must still be near the entry zone to be actionable.
  const distFromZone =
    quote.lastPrice > technical.entryZone.high
      ? quote.lastPrice - technical.entryZone.high
      : quote.lastPrice < technical.entryZone.low
        ? technical.entryZone.low - quote.lastPrice
        : 0;
  if (distFromZone > rr.riskPerShare) issues.push("Harga terakhir sudah jauh (>1R) dari area entry.");

  let status: RiskStatus = "eligible";
  const mainRR = rr.ratios[1] ?? rr.ratios[0];
  if (mainRR < minRiskReward) {
    status = "rejected";
    issues.push(`R/R target utama ${mainRR.toFixed(2)} di bawah minimum ${minRiskReward} (mode ${mode}).`);
  } else if (rr.ratios[0] < 1) {
    status = "caution";
    issues.push(`R/R TP1 hanya ${rr.ratios[0].toFixed(2)} (< 1R).`);
  }
  if (status === "eligible" && issues.length > 0) status = "caution";

  let position: RiskReport["position"] = null;
  try {
    position = positionSize({
      market,
      accountSize: params.accountSize ?? DEFAULT_ACCOUNT[market],
      riskPct: params.riskPct ?? DEFAULT_RISK_PCT,
      entry: mid,
      stopLoss: technical.stopLoss,
    });
    if (position.shares === 0) issues.push("Ukuran modal/risiko terlalu kecil untuk 1 lot pada stop ini.");
  } catch (e) {
    issues.push((e as Error).message);
  }

  return {
    ...base,
    status,
    riskPerShare: rr.riskPerShare,
    rewardPerShare: rr.rewardPerShare,
    riskReward: rr.ratios,
    position,
    issues,
  };
}
