import { describe, expect, it } from "vitest";
import { atr, ema, last, macd, pivotLevels, rsi, sma } from "./indicators";

const closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.0, 46.03, 46.41, 46.22, 45.64];

describe("moving averages", () => {
  it("sma aligns with input and pads with null", () => {
    const out = sma([1, 2, 3, 4], 2);
    expect(out).toEqual([null, 1.5, 2.5, 3.5]);
  });

  it("ema seeds with sma", () => {
    const out = ema([1, 2, 3, 4], 3);
    expect(out[2]).toBe(2);
    expect(out[3]).toBe(3);
  });
});

describe("rsi", () => {
  it("matches the classic Wilder example", () => {
    const out = rsi(closes, 14);
    expect(out[14]).toBeCloseTo(70.46, 1);
  });

  it("is 100 when price only rises", () => {
    expect(last(rsi([1, 2, 3, 4, 5, 6], 3))).toBe(100);
  });
});

describe("macd", () => {
  it("returns aligned arrays", () => {
    const series = Array.from({ length: 60 }, (_, i) => 100 + i);
    const m = macd(series);
    expect(m.line.length).toBe(60);
    expect(last(m.line)).toBeGreaterThan(0);
    expect(last(m.hist)).not.toBeNull();
  });
});

describe("atr & pivots", () => {
  const candles = Array.from({ length: 30 }, (_, i) => {
    const base = 100 + 5 * Math.sin(i / 3);
    return { time: i + 1, open: base, high: base + 1, low: base - 1, close: base, volume: 1000 };
  });

  it("atr is positive once warmed up", () => {
    expect(last(atr(candles, 14))).toBeGreaterThan(0);
  });

  it("finds swing highs and lows", () => {
    const p = pivotLevels(candles, 2);
    expect(p.highs.length).toBeGreaterThan(0);
    expect(p.lows.length).toBeGreaterThan(0);
  });
});
