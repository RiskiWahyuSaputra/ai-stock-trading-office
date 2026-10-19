import type { Candle } from "@/lib/domain/schemas";

/**
 * Pure technical indicator functions. Each returns an array aligned with the
 * input, using `null` where there is not enough history yet.
 */

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    if (prev === null) {
      // Seed with the SMA of the first `period` values.
      let seed = 0;
      for (let j = i - period + 1; j <= i; j++) seed += values[j];
      prev = seed / period;
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out.push(prev);
  }
  return out;
}

/** Wilder's RSI. */
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = toRsi(avgGain, avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = toRsi(avgGain, avgLoss);
  }
  return out;
}

function toRsi(avgGain: number, avgLoss: number) {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const fastE = ema(values, fast);
  const slowE = ema(values, slow);
  const line: (number | null)[] = values.map((_, i) =>
    fastE[i] !== null && slowE[i] !== null ? (fastE[i] as number) - (slowE[i] as number) : null,
  );
  const firstValid = line.findIndex((v) => v !== null);
  const signalLine: (number | null)[] = new Array(values.length).fill(null);
  if (firstValid >= 0) {
    const compact = line.slice(firstValid) as number[];
    const sig = ema(compact, signal);
    sig.forEach((v, i) => (signalLine[firstValid + i] = v));
  }
  const hist = line.map((v, i) =>
    v !== null && signalLine[i] !== null ? v - (signalLine[i] as number) : null,
  );
  return { line, signal: signalLine, hist };
}

/** Wilder's Average True Range. */
export function atr(candles: Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length <= period) return out;
  const tr = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const pc = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc));
  });
  let prev = 0;
  for (let i = 1; i <= period; i++) prev += tr[i];
  prev /= period;
  out[period] = prev;
  for (let i = period + 1; i < candles.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

/**
 * Swing pivots: a high (low) that is the extreme of `strength` bars on each
 * side. Returns de-duplicated levels (merged within `mergePct`).
 */
export function pivotLevels(candles: Candle[], strength = 3, mergePct = 0.006) {
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = strength; i < candles.length - strength; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - strength; j <= i + strength; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low <= candles[i].low) isLow = false;
    }
    if (isHigh) highs.push(candles[i].high);
    if (isLow) lows.push(candles[i].low);
  }
  return { highs: mergeLevels(highs, mergePct), lows: mergeLevels(lows, mergePct) };
}

function mergeLevels(levels: number[], mergePct: number) {
  const sorted = [...levels].sort((a, b) => a - b);
  const merged: number[] = [];
  for (const lv of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && Math.abs(lv - last) / last <= mergePct) {
      merged[merged.length - 1] = (last + lv) / 2;
    } else {
      merged.push(lv);
    }
  }
  return merged;
}

export function last<T>(arr: (T | null)[]): T | null {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] !== null) return arr[i];
  return null;
}
