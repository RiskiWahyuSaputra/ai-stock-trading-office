import { describe, expect, it } from "vitest";
import { maxGapPct, positionSize, riskReward, roundToTick, validateLevels } from "./risk";

describe("validateLevels", () => {
  it("accepts a consistent long setup", () => {
    expect(validateLevels("long", { low: 100, high: 102 }, 95, [110, 120]).valid).toBe(true);
  });

  it("rejects a long stop loss inside the entry zone", () => {
    const res = validateLevels("long", { low: 100, high: 102 }, 101, [110]);
    expect(res.valid).toBe(false);
  });

  it("rejects unordered short targets", () => {
    const res = validateLevels("short", { low: 100, high: 102 }, 106, [90, 95]);
    expect(res.valid).toBe(false);
  });
});

describe("riskReward", () => {
  it("computes ratios from the entry midpoint", () => {
    const rr = riskReward("long", { low: 99, high: 101 }, 95, [105, 110]);
    expect(rr.riskPerShare).toBe(5);
    expect(rr.ratios).toEqual([1, 2]);
  });

  it("throws on inconsistent levels", () => {
    expect(() => riskReward("long", { low: 99, high: 101 }, 102, [110])).toThrow();
  });
});

describe("positionSize", () => {
  it("rounds IDX positions down to whole lots", () => {
    const p = positionSize({ market: "IDX", accountSize: 100_000_000, riskPct: 1, entry: 9000, stopLoss: 8700 });
    expect(p.maxLoss).toBe(1_000_000);
    expect(p.lots).toBe(33);
    expect(p.shares).toBe(3300);
  });

  it("caps shares by account value", () => {
    const p = positionSize({ market: "US", accountSize: 1000, riskPct: 10, entry: 100, stopLoss: 99.9 });
    expect(p.shares).toBe(10);
  });
});

describe("helpers", () => {
  it("measures the largest gap", () => {
    expect(maxGapPct([{ open: 100, close: 100 }, { open: 105, close: 104 }, { open: 103, close: 103 }])).toBe(5);
  });

  it("rounds to IDX tick sizes", () => {
    expect(roundToTick(9013, "IDX")).toBe(9025);
    expect(roundToTick(1233, "IDX", "down")).toBe(1230);
    expect(roundToTick(187.456, "US")).toBe(187.46);
  });
});
