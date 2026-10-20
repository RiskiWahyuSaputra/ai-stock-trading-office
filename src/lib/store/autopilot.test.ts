import { describe, expect, it } from "vitest";
import type { EntryTiming, ScreenItem } from "@/lib/domain/schemas";
import { buildQueue } from "./autopilot";
import { useOffice, type ScreenerState } from "./office-store";

const item = (symbol: string, timing: EntryTiming, confidence: number, trendScore = 0): ScreenItem => ({
  stock: { symbol, name: symbol, market: "IDX", sector: "-", currency: "IDR" },
  lastPrice: 1000,
  changePct: 0,
  status: "WAIT",
  direction: "neutral",
  trendScore,
  confidence,
  plan: { timing, trigger: "none", day: null, etaDays: null, triggerPrice: null, headline: "", reasons: [] },
});

const screener = (items: ScreenItem[]): ScreenerState => ({
  scanId: "s",
  request: { market: "IDX", mode: "balanced" },
  phase: "completed",
  done: items.length,
  total: items.length,
  today: null,
  nextDay: null,
  sessionLabel: null,
  items,
  errors: [],
  isDemo: true,
  startedAt: 0,
  finishedAt: 0,
});

describe("autopilot queue", () => {
  it("puts radar candidates first (soonest, strongest), then the watchlist", () => {
    useOffice.setState({
      screener: screener([item("AAA", "later", 80), item("BBB", "today", 50), item("CCC", "avoid", 90), item("DDD", "next_session", 60)]),
      watchlist: [
        { symbol: "BBB", market: "IDX", addedAt: 0 },
        { symbol: "EEE", market: "IDX", addedAt: 0 },
        { symbol: "NVDA", market: "US", addedAt: 0 },
      ],
    });
    expect(buildQueue("IDX")).toEqual(["BBB", "DDD", "AAA", "EEE"]);
  });

  it("falls back to the least-weak charts so the office never idles", () => {
    useOffice.setState({
      screener: screener([item("AAA", "avoid", 10, -0.9), item("BBB", "avoid", 10, -0.2), item("CCC", "avoid", 10, -0.5), item("DDD", "avoid", 10, -1)]),
      watchlist: [],
    });
    expect(buildQueue("IDX")).toEqual(["BBB", "CCC", "AAA"]);
  });
});
