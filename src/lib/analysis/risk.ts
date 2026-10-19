import type { Market, PriceZone } from "@/lib/domain/schemas";

/**
 * Deterministic risk math. These functions — not model-generated text — are
 * the single source of truth for distances, R/R and position size.
 */

export type TradeSide = "long" | "short";

export interface LevelCheck {
  valid: boolean;
  issues: string[];
}

export function zoneMid(zone: PriceZone) {
  return (zone.low + zone.high) / 2;
}

/** Validate that entry, SL and TPs are ordered correctly for the trade side. */
export function validateLevels(
  side: TradeSide,
  entry: PriceZone,
  stopLoss: number,
  takeProfits: number[],
): LevelCheck {
  const issues: string[] = [];
  const finite = [entry.low, entry.high, stopLoss, ...takeProfits].every(
    (v) => Number.isFinite(v) && v > 0,
  );
  if (!finite) issues.push("Level harga harus berupa angka positif.");
  if (entry.low > entry.high) issues.push("Batas bawah entry lebih besar dari batas atas.");
  if (takeProfits.length === 0) issues.push("Tidak ada target take profit.");

  if (side === "long") {
    if (stopLoss >= entry.low) issues.push("Stop loss long harus di bawah area entry.");
    takeProfits.forEach((tp, i) => {
      if (tp <= entry.high) issues.push(`TP${i + 1} long harus di atas area entry.`);
      if (i > 0 && tp <= takeProfits[i - 1]) issues.push(`TP${i + 1} harus lebih tinggi dari TP${i}.`);
    });
  } else {
    if (stopLoss <= entry.high) issues.push("Stop loss short harus di atas area entry.");
    takeProfits.forEach((tp, i) => {
      if (tp >= entry.low) issues.push(`TP${i + 1} short harus di bawah area entry.`);
      if (i > 0 && tp >= takeProfits[i - 1]) issues.push(`TP${i + 1} harus lebih rendah dari TP${i}.`);
    });
  }
  return { valid: issues.length === 0, issues };
}

/**
 * Risk/reward measured from the entry-zone midpoint. Throws if the levels are
 * not consistent — callers must validate first.
 */
export function riskReward(side: TradeSide, entry: PriceZone, stopLoss: number, takeProfits: number[]) {
  const check = validateLevels(side, entry, stopLoss, takeProfits);
  if (!check.valid) throw new Error(`Invalid levels: ${check.issues.join(" ")}`);
  const mid = zoneMid(entry);
  const risk = Math.abs(mid - stopLoss);
  const rewards = takeProfits.map((tp) => Math.abs(tp - mid));
  return {
    riskPerShare: risk,
    rewardPerShare: rewards,
    ratios: rewards.map((r) => round(r / risk, 2)),
  };
}

export const LOT_SIZE: Record<Market, number | null> = { IDX: 100, US: null };

export function positionSize(params: {
  market: Market;
  accountSize: number;
  riskPct: number;
  entry: number;
  stopLoss: number;
}) {
  const { market, accountSize, riskPct, entry, stopLoss } = params;
  if (accountSize <= 0 || riskPct <= 0) throw new Error("Account size and risk % must be positive.");
  const perShare = Math.abs(entry - stopLoss);
  if (perShare === 0) throw new Error("Entry and stop loss cannot be equal.");
  const maxLoss = (accountSize * riskPct) / 100;
  const lot = LOT_SIZE[market];
  let shares = Math.floor(maxLoss / perShare);
  // Do not let position value exceed the account.
  shares = Math.min(shares, Math.floor(accountSize / entry));
  let lots: number | null = null;
  if (lot) {
    lots = Math.floor(shares / lot);
    shares = lots * lot;
  }
  return {
    accountSize,
    riskPct,
    maxLoss: round(maxLoss, 2),
    shares,
    lots,
    positionValue: round(shares * entry, 2),
  };
}

/** Largest open-vs-previous-close gap in percent over the given bars. */
export function maxGapPct(bars: { open: number; close: number }[]) {
  let max = 0;
  for (let i = 1; i < bars.length; i++) {
    const gap = Math.abs(bars[i].open - bars[i - 1].close) / bars[i - 1].close;
    if (gap > max) max = gap;
  }
  return round(max * 100, 2);
}

/** IDX price fractions (tick size) by price band. */
export function idxTickSize(price: number) {
  if (price < 200) return 1;
  if (price < 500) return 2;
  if (price < 2000) return 5;
  if (price < 5000) return 10;
  return 25;
}

/** Round a price to a valid tick for its market. */
export function roundToTick(price: number, market: Market, mode: "down" | "up" | "nearest" = "nearest") {
  const tick = market === "IDX" ? idxTickSize(price) : 0.01;
  const fn = mode === "down" ? Math.floor : mode === "up" ? Math.ceil : Math.round;
  return round(fn(price / tick) * tick, market === "IDX" ? 0 : 2);
}

export function round(v: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
