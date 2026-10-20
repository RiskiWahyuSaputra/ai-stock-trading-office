import { describe, expect, it } from "vitest";
import type { CandleSeries, FinalReport, NewsItem, Quote } from "@/lib/domain/schemas";
import { entryWindow, type EntryWindow } from "@/lib/market-hours";
import { compareCandidates, planEntry } from "./entry-planner";
import { buildFinalReport } from "./final-officer";
import { runNewsResearch } from "./news-researcher";
import { runRiskCheck } from "./risk-manager";
import { runReview } from "./signal-reviewer";
import { runTechnicalAnalysis } from "./technical-analyst";

const source = { id: "t", name: "t", isDemo: true };
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 20, 3); // Tue 10:00 WIB

const OPEN: EntryWindow = { today: "2026-10-20", sessionAhead: true, nextDay: "2026-10-21", label: "Sesi 1" };
const CLOSED: EntryWindow = { today: "2026-10-20", sessionAhead: false, nextDay: "2026-10-21", label: "Tutup" };

/** Full agent pipeline on a synthetic daily series ending at NOW. */
function reportFor(price: (i: number) => number, headlines: string[] = []): FinalReport {
  const n = 150;
  const candles = Array.from({ length: n }, (_, i) => {
    const p = price(i);
    return { time: NOW - (n - 1 - i) * DAY, open: p - 2, high: p + 10, low: p - 10, close: p, volume: 1e6 };
  });
  const series: CandleSeries = { symbol: "T", timeframe: "1D", candles, source, fetchedAt: NOW };
  const last = candles[n - 1].close;
  const quote: Quote = {
    stock: { symbol: "T", name: "Test", market: "IDX", sector: "-", currency: "IDR" },
    lastPrice: last,
    change: 0,
    changePct: 0,
    timestamp: NOW,
    source,
    marketOpen: true,
  };
  const items: NewsItem[] = headlines.map((h, i) => ({ id: `n${i}`, symbol: "T", headline: h, summary: "", publisher: "x", publishedAt: NOW - 3_600_000, source }));
  const request = { symbol: "T", market: "IDX" as const, timeframe: "1D" as const, mode: "balanced" as const };
  const technical = runTechnicalAnalysis(series, "IDX", "balanced", NOW);
  const news = runNewsResearch(items, source, NOW);
  const risk = runRiskCheck({ technical, candles, quote, mode: "balanced", market: "IDX", now: NOW });
  const review = runReview({ news, technical, risk, quote, now: NOW });
  return buildFinalReport({ id: "r", request, quote, news, technical, risk, review, now: NOW });
}

const uptrend = (i: number) => 1000 + i * 5 + 20 * Math.sin(i / 4);
const downtrend = (i: number) => 3000 - i * 8 + 20 * Math.sin(i / 4);
const flat = (i: number) => 1000 + 15 * Math.sin(i / 3);

describe("entry window", () => {
  it("treats a weekday before the close as still tradable today", () => {
    expect(entryWindow("IDX", new Date(NOW))).toMatchObject({ today: "2026-10-20", sessionAhead: true, nextDay: "2026-10-21" });
  });

  it("rolls Friday after the close and the weekend to Monday", () => {
    const fridayEvening = new Date(Date.UTC(2026, 9, 23, 10)); // Fri 17:00 WIB
    expect(entryWindow("IDX", fridayEvening)).toMatchObject({ sessionAhead: false, nextDay: "2026-10-26" });
    const saturday = new Date(Date.UTC(2026, 9, 24, 3));
    expect(entryWindow("IDX", saturday)).toMatchObject({ sessionAhead: false, nextDay: "2026-10-26" });
  });

  it("uses the exchange's own date for US stocks", () => {
    // 03:00 UTC Tuesday is still Monday evening in New York, after the close.
    expect(entryWindow("US", new Date(NOW))).toMatchObject({ today: "2026-10-19", sessionAhead: false, nextDay: "2026-10-20" });
  });
});

describe("entry planner", () => {
  it("avoids downtrends", () => {
    const plan = planEntry(reportFor(downtrend), OPEN);
    expect(plan.timing).toBe("avoid");
  });

  it("avoids sideways charts without improving momentum", () => {
    const r = reportFor(flat);
    expect(r.technical.direction).toBe("neutral");
    expect(r.technical.trendScore).toBeLessThan(0.15);
    expect(planEntry(r, OPEN).timing).toBe("avoid");
  });

  it("puts an approved buy setup in today's session, or the next one after the close", () => {
    const r = reportFor(uptrend, ["T reports record profit", "T announces buyback"]);
    const buy: FinalReport = { ...r, status: "BUY_SETUP", entryZone: r.technical.entryZone, stopLoss: r.technical.stopLoss, riskReward: r.risk.riskReward };
    expect(planEntry(buy, OPEN)).toMatchObject({ timing: "today", trigger: "in_zone", day: "2026-10-20" });
    expect(planEntry(buy, CLOSED)).toMatchObject({ timing: "next_session", day: "2026-10-21" });
  });

  it("waits for a pullback when price already ran far above the zone", () => {
    const r = reportFor(uptrend);
    const zone = r.technical.entryZone!;
    const atr = r.technical.indicators.atr14!;
    const buy: FinalReport = {
      ...r,
      status: "BUY_SETUP",
      entryZone: zone,
      stopLoss: r.technical.stopLoss,
      quote: { ...r.quote, lastPrice: zone.high + 3 * atr },
    };
    const plan = planEntry(buy, OPEN);
    expect(plan).toMatchObject({ timing: "later", trigger: "pullback", triggerPrice: zone.high });
    expect(plan.etaDays![0]).toBeGreaterThanOrEqual(3);
  });

  it("waits when news contradicts a bullish chart", () => {
    const r = reportFor(uptrend, ["T faces fraud investigation", "T profit warning, shares plunge"]);
    expect(r.review.verdict).toBe("conflicting");
    expect(planEntry(r, OPEN)).toMatchObject({ timing: "later", trigger: "confirmation" });
  });

  it("ranks sooner timings first, then by confluence", () => {
    const mk = (timing: "today" | "later", confidence: number) => ({
      plan: { timing, trigger: "none" as const, day: null, etaDays: null, triggerPrice: null, headline: "", reasons: [] },
      confidence,
    });
    const sorted = [mk("later", 90), mk("today", 40), mk("today", 70)].sort(compareCandidates);
    expect(sorted.map((x) => [x.plan.timing, x.confidence])).toEqual([["today", 70], ["today", 40], ["later", 90]]);
  });
});
