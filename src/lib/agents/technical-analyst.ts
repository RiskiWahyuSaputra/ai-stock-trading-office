import { atr, ema, last, macd, pivotLevels, rsi, sma } from "@/lib/analysis/indicators";
import { roundToTick } from "@/lib/analysis/risk";
import type {
  AnalysisMode,
  CandleSeries,
  Direction,
  Market,
  PriceZone,
  TechnicalReport,
} from "@/lib/domain/schemas";

export const MIN_CANDLES = 60;

/** Stop distance multiplier (× ATR) per risk profile. */
export const ATR_MULT: Record<AnalysisMode, number> = { conservative: 1.5, balanced: 1.2, aggressive: 1.0 };

/**
 * Technical Analyst — derives trend and price levels ONLY from the candle
 * series it receives. Every level is computed from data with a named method.
 */
export function runTechnicalAnalysis(
  series: CandleSeries,
  market: Market,
  mode: AnalysisMode,
  now = Date.now(),
): TechnicalReport {
  const { candles } = series;
  const closes = candles.map((c) => c.close);
  const lastBar = candles[candles.length - 1];
  const base = {
    timeframe: series.timeframe,
    candlesUsed: candles.length,
    lastClose: lastBar.close,
    source: series.source,
    dataTimestamp: lastBar.time,
    completedAt: now,
  };

  const s20 = sma(closes, 20);
  const s50 = sma(closes, 50);
  const e200 = ema(closes, 200);
  const r = rsi(closes, 14);
  const m = macd(closes);
  const a = atr(candles, 14);
  const vol20 = sma(
    candles.map((c) => c.volume),
    20,
  );
  const indicators = {
    sma20: last(s20),
    sma50: last(s50),
    ema200: last(e200),
    rsi14: last(r),
    macd: last(m.line),
    macdSignal: last(m.signal),
    macdHist: last(m.hist),
    atr14: last(a),
    volumeRatio: last(vol20) ? lastBar.volume / (last(vol20) as number) : null,
  };

  if (candles.length < MIN_CANDLES || indicators.atr14 === null) {
    return {
      ...base,
      direction: "neutral",
      trendScore: 0,
      indicators,
      supports: [],
      resistances: [],
      entryZone: null,
      stopLoss: null,
      takeProfits: [],
      invalidationLevel: null,
      reasons: [`Data candle tidak cukup (${candles.length}/${MIN_CANDLES}) untuk analisis yang andal.`],
      methods: [],
    };
  }

  const price = lastBar.close;
  const atrV = indicators.atr14;
  const reasons: string[] = [];
  let score = 0;
  const add = (cond: boolean, w: number, yes: string, no: string) => {
    score += cond ? w : -w;
    reasons.push(cond ? yes : no);
  };

  const { sma20, sma50, ema200, rsi14, macdHist } = indicators;
  if (sma20 !== null) add(price > sma20, 0.2, "Harga di atas SMA20.", "Harga di bawah SMA20.");
  if (sma20 !== null && sma50 !== null) add(sma20 > sma50, 0.25, "SMA20 di atas SMA50 (struktur naik).", "SMA20 di bawah SMA50 (struktur turun).");
  const s20Prev = s20[s20.length - 6];
  if (sma20 !== null && s20Prev !== null) add(sma20 > s20Prev, 0.15, "SMA20 menanjak 5 bar terakhir.", "SMA20 menurun 5 bar terakhir.");
  if (macdHist !== null) add(macdHist > 0, 0.15, "Histogram MACD positif.", "Histogram MACD negatif.");
  if (ema200 !== null) add(price > ema200, 0.1, "Harga di atas EMA200.", "Harga di bawah EMA200.");
  if (rsi14 !== null) {
    if (rsi14 > 55) {
      score += 0.15;
      reasons.push(`RSI ${rsi14.toFixed(1)} menunjukkan momentum positif.`);
    } else if (rsi14 < 45) {
      score -= 0.15;
      reasons.push(`RSI ${rsi14.toFixed(1)} menunjukkan momentum lemah.`);
    } else reasons.push(`RSI ${rsi14.toFixed(1)} netral.`);
    if (rsi14 > 75) {
      score -= 0.1;
      reasons.push("RSI overbought (>75): risiko pullback.");
    }
    if (rsi14 < 25) {
      score += 0.1;
      reasons.push("RSI oversold (<25): risiko pantulan.");
    }
  }
  const trendScore = Math.max(-1, Math.min(1, Math.round(score * 100) / 100));
  const direction: Direction = trendScore >= 0.35 ? "bullish" : trendScore <= -0.35 ? "bearish" : "neutral";

  const pivots = pivotLevels(candles.slice(-120), 3);
  const supports = pivots.lows.filter((l) => l < price).sort((x, y) => y - x).slice(0, 3);
  const resistances = pivots.highs.filter((h) => h > price).sort((x, y) => x - y).slice(0, 3);
  const tick = (p: number, dir: "up" | "down" | "nearest" = "nearest") => roundToTick(p, market, dir);

  const common = {
    ...base,
    direction,
    trendScore,
    indicators,
    supports: supports.map((v) => tick(v)),
    resistances: resistances.map((v) => tick(v)),
  };

  if (direction === "neutral") {
    reasons.push("Skor tren tidak melewati ambang ±0.35 → tidak ada setup arah yang jelas.");
    return { ...common, entryZone: null, stopLoss: null, takeProfits: [], invalidationLevel: null, reasons, methods: [] };
  }

  const mult = ATR_MULT[mode];
  const methods: string[] = [];
  let entryZone: PriceZone;
  let stopLoss: number;
  let takeProfits: number[];

  if (direction === "bullish") {
    const sup = supports[0] ?? price - 2 * atrV;
    const low = Math.max(sup, price - 0.5 * atrV);
    entryZone = { low: tick(Math.min(low, price - 0.2 * atrV), "down"), high: tick(price, "nearest") };
    const atrStop = entryZone.low - mult * atrV;
    const structStop = sup - 0.25 * atrV;
    stopLoss = tick(Math.max(Math.min(atrStop, structStop), entryZone.low - 3 * atrV), "down");
    const mid = (entryZone.low + entryZone.high) / 2;
    const R = mid - stopLoss;
    const res = resistances.filter((x) => x >= mid + 0.8 * R);
    const tp1 = res[0] ?? mid + 1.5 * R;
    const tp2 = Math.max(res[1] ?? mid + 2.5 * R, tp1 + 0.5 * R);
    const tp3 = Math.max(mid + 3.5 * R, tp2 + 0.5 * R);
    takeProfits = [tick(tp1, "down"), tick(tp2, "down"), tick(tp3, "down")];
    methods.push(
      `Entry: area pullback antara max(support terdekat, close − 0.5×ATR) dan close terakhir.`,
      `SL: lebih rendah dari (entry bawah − ${mult}×ATR) dan (support − 0.25×ATR), maks 3×ATR.`,
      `TP1/TP2: resistance pivot ≥ 0.8R bila ada, jika tidak 1.5R / 2.5R; TP3: 3.5R.`,
    );
  } else {
    const resi = resistances[0] ?? price + 2 * atrV;
    const high = Math.min(resi, price + 0.5 * atrV);
    entryZone = { low: tick(price, "nearest"), high: tick(Math.max(high, price + 0.2 * atrV), "up") };
    const atrStop = entryZone.high + mult * atrV;
    const structStop = resi + 0.25 * atrV;
    stopLoss = tick(Math.min(Math.max(atrStop, structStop), entryZone.high + 3 * atrV), "up");
    const mid = (entryZone.low + entryZone.high) / 2;
    const R = stopLoss - mid;
    const sup = supports.filter((x) => x <= mid - 0.8 * R);
    const tp1 = sup[0] ?? mid - 1.5 * R;
    const tp2 = Math.min(sup[1] ?? mid - 2.5 * R, tp1 - 0.5 * R);
    const tp3 = Math.min(mid - 3.5 * R, tp2 - 0.5 * R);
    takeProfits = [tp1, tp2, tp3].filter((v) => v > 0).map((v) => tick(v, "up"));
    methods.push(
      `Entry: area pantulan antara close terakhir dan min(resistance terdekat, close + 0.5×ATR).`,
      `SL: lebih tinggi dari (entry atas + ${mult}×ATR) dan (resistance + 0.25×ATR), maks 3×ATR.`,
      `TP1/TP2: support pivot ≥ 0.8R bila ada, jika tidak 1.5R / 2.5R; TP3: 3.5R.`,
    );
  }

  return {
    ...common,
    entryZone,
    stopLoss,
    takeProfits,
    invalidationLevel: stopLoss,
    reasons,
    methods: [`ATR14 = ${atrV.toFixed(2)}; pivot strength 3 bar, 120 bar terakhir.`, ...methods],
  };
}
