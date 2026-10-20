import { roundToTick } from "@/lib/analysis/risk";
import type { EntryPlan, EntryTiming, FinalReport } from "@/lib/domain/schemas";
import type { EntryWindow } from "@/lib/market-hours";

/** Trend score from which a neutral chart counts as "improving". */
export const IMPROVING_SCORE = 0.15;
/** RSI above which a bullish chart is treated as extended (wait for a pullback). */
export const EXTENDED_RSI = 70;
/** Max distance (× ATR) to a resistance for a breakout to be worth watching. */
export const BREAKOUT_RANGE_ATR = 1.5;
/** Max distance (× ATR) for a trigger to plausibly be reached by the next session. */
export const NEAR_ATR = 0.5;

export const TIMING_ORDER: Record<EntryTiming, number> = { today: 0, next_session: 1, later: 2, avoid: 3 };

/**
 * Entry Planner — turns a Final Signal Officer report into WHEN a long entry
 * can be taken. Only buy entries are planned (IDX retail cannot short).
 * Timing estimates divide price distance by ATR14 (average daily range), so
 * they are rough orders of magnitude, never forecasts.
 */
export function planEntry(report: FinalReport, window: EntryWindow): EntryPlan {
  const { technical: t, risk, review, quote } = report;
  const market = report.request.market;
  const price = quote.lastPrice;
  const atr = t.indicators.atr14;
  const tick = (p: number) => roundToTick(p, market, "up");
  const eta = (dist: number): [number, number] | null =>
    atr ? [Math.max(1, Math.ceil(dist / atr)), Math.max(2, Math.ceil((2 * dist) / atr) + 1)] : null;
  const soonest = window.sessionAhead ? window.today : window.nextDay;
  const soonestTiming: EntryTiming = window.sessionAhead ? "today" : "next_session";

  const plan = (p: Omit<EntryPlan, "reasons"> & { reasons?: string[] }): EntryPlan => ({ reasons: [], ...p });
  const avoid = (headline: string, reasons: string[] = []) =>
    plan({ timing: "avoid", trigger: "none", day: null, etaDays: null, triggerPrice: null, headline, reasons });

  if (report.status === "NO_TRADE" && review.verdict === "insufficient_data") {
    return avoid("Data tidak cukup atau kedaluwarsa.", review.checks.filter((c) => !c.passed).map((c) => c.detail));
  }
  if (t.direction === "bearish") {
    return avoid(`Tren turun (skor ${t.trendScore.toFixed(2)}) — bukan waktunya beli.`, t.reasons.slice(0, 3));
  }

  // 1. Approved buy setup: price is at the entry zone now.
  if (report.status === "BUY_SETUP" && report.entryZone) {
    const zone = report.entryZone;
    const above = price - zone.high;
    const reasons = [
      `Setup BUY disetujui reviewer, konfluensi ${report.confidence.score}/100.`,
      `Zona entry ${zone.low}–${zone.high}, SL ${report.stopLoss}, R/R ${report.riskReward.map((r) => r.toFixed(2)).join(" / ")}.`,
    ];
    if (above <= 0 || (atr !== null && above <= NEAR_ATR * atr)) {
      const where = above <= 0 ? "Harga sudah di zona entry." : `Harga ${above.toFixed(market === "IDX" ? 0 : 2)} di atas zona — antre beli (limit) di zona.`;
      return plan({
        timing: soonestTiming,
        trigger: "in_zone",
        day: soonest,
        etaDays: null,
        triggerPrice: zone.high,
        headline: window.sessionAhead ? `Bisa entry hari ini di ${zone.low}–${zone.high}.` : `Entry sesi berikutnya bila harga masih di ${zone.low}–${zone.high}.`,
        reasons: [where, ...reasons, ...(window.sessionAhead ? [] : ["Pasar sudah tutup: cek ulang harga pembukaan, batalkan bila gap jauh di atas zona."])],
      });
    }
    return plan({
      timing: "later",
      trigger: "pullback",
      day: null,
      etaDays: eta(above),
      triggerPrice: zone.high,
      headline: `Tunggu pullback ke ${zone.low}–${zone.high}.`,
      reasons: [`Harga sudah ${(above / (atr as number)).toFixed(1)}×ATR di atas zona.`, ...reasons],
    });
  }

  // 2. Bullish chart that is not approved yet: find what it is waiting for.
  if (t.direction === "bullish") {
    const sma20 = t.indicators.sma20;
    const rsi = t.indicators.rsi14;
    const extended = (rsi !== null && rsi > EXTENDED_RSI) || (sma20 !== null && atr !== null && price - sma20 > 2 * atr);
    if (review.verdict === "conflicting") {
      return plan({
        timing: "later",
        trigger: "confirmation",
        day: null,
        etaDays: null,
        triggerPrice: null,
        headline: "Teknikal naik tetapi berita berlawanan — tunggu kejelasan.",
        reasons: review.conflicts,
      });
    }
    if (extended && sma20 !== null) {
      const target = tick(Math.max(sma20, t.supports[0] ?? 0));
      return plan({
        timing: "later",
        trigger: "pullback",
        day: null,
        etaDays: eta(price - target),
        triggerPrice: target,
        headline: `Sudah naik tinggi — tunggu pullback ke sekitar ${target}.`,
        reasons: [
          rsi !== null && rsi > EXTENDED_RSI ? `RSI ${rsi.toFixed(1)} (> ${EXTENDED_RSI}): rawan koreksi.` : `Harga > 2×ATR di atas SMA20.`,
          ...risk.issues.slice(0, 2),
        ],
      });
    }
    const res = t.resistances[0];
    const rrRejected = risk.status === "rejected" && risk.riskReward.length > 0;
    if (rrRejected && res !== undefined && atr !== null) {
      return breakout(res, atr, [`Resistance ${res} terlalu dekat: R/R belum memenuhi minimum ${risk.minRiskReward}.`]);
    }
    return plan({
      timing: "later",
      trigger: "confirmation",
      day: null,
      etaDays: null,
      triggerPrice: null,
      headline: "Tren naik, tetapi pemeriksaan risiko/review belum lolos.",
      reasons: [...risk.issues, ...review.checks.filter((c) => !c.passed).map((c) => `${c.label}: ${c.detail}`)].slice(0, 3),
    });
  }

  // 3. Neutral chart: only interesting when momentum improves near a resistance.
  if (t.trendScore >= IMPROVING_SCORE && atr !== null) {
    const res = t.resistances[0];
    if (res !== undefined && res - price <= BREAKOUT_RANGE_ATR * atr) {
      return breakout(res, atr, [`Skor tren ${t.trendScore.toFixed(2)} membaik, belum melewati ambang 0.35.`]);
    }
    return plan({
      timing: "later",
      trigger: "confirmation",
      day: null,
      etaDays: null,
      triggerPrice: null,
      headline: "Momentum membaik — pantau sampai tren terkonfirmasi.",
      reasons: [`Skor tren ${t.trendScore.toFixed(2)} (butuh ≥ 0.35 untuk setup).`],
    });
  }
  return avoid("Belum ada arah yang jelas (sideways).", [`Skor tren ${t.trendScore.toFixed(2)}.`]);

  function breakout(res: number, atrV: number, why: string[]): EntryPlan {
    const trigger = tick(res + 0.1 * atrV);
    const dist = trigger - price;
    // A daily close above the trigger confirms; the entry is the session after
    // that close — tomorrow only if today's session can still close above it.
    const tomorrow = dist <= NEAR_ATR * atrV && window.sessionAhead;
    return plan({
      timing: tomorrow ? "next_session" : "later",
      trigger: "breakout",
      day: tomorrow ? window.nextDay : null,
      etaDays: tomorrow ? null : dist <= NEAR_ATR * atrV ? [1, 2] : eta(dist),
      triggerPrice: trigger,
      headline: `Beli bila close harian di atas ${trigger} dengan volume di atas rata-rata.`,
      reasons: [...why, `Resistance terdekat ${res}; jarak ${(dist / atrV).toFixed(1)}×ATR.`],
    });
  }
}

/** Ranking inside the radar: soonest timing first, then confluence, then main R/R. */
export function compareCandidates(
  a: { plan: EntryPlan; confidence: number; report?: FinalReport },
  b: { plan: EntryPlan; confidence: number; report?: FinalReport },
) {
  const rr = (x: typeof a) => x.report?.riskReward[1] ?? x.report?.riskReward[0] ?? 0;
  return TIMING_ORDER[a.plan.timing] - TIMING_ORDER[b.plan.timing] || b.confidence - a.confidence || rr(b) - rr(a);
}
