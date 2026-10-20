import { describe, expect, it, vi } from "vitest";
import { buildFinalReport } from "@/lib/agents/final-officer";
import { runNewsResearch } from "@/lib/agents/news-researcher";
import { runRiskCheck } from "@/lib/agents/risk-manager";
import { runReview } from "@/lib/agents/signal-reviewer";
import { runTechnicalAnalysis } from "@/lib/agents/technical-analyst";
import type { CandleSeries, EntryTiming, FinalReport, Quote, ScreenItem, WorkflowEvent } from "@/lib/domain/schemas";
import { buildQueue } from "./autopilot";
import { useOffice, type ScreenerState } from "./office-store";

const streamed: { events: WorkflowEvent[] } = { events: [] };
vi.mock("@/lib/api/client", () => ({
  api: {},
  streamScreener: async function* () {},
  async *streamAnalysis() {
    yield* streamed.events;
  },
}));

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

/** A real pipeline report for a synthetic uptrend, forced to an approved BUY. */
function buyReport(symbol: string): FinalReport {
  const now = Date.now();
  const source = { id: "t", name: "t", isDemo: true };
  const candles = Array.from({ length: 150 }, (_, i) => {
    const p = 1000 + i * 5 + 20 * Math.sin(i / 4);
    return { time: now - (149 - i) * 86_400_000, open: p - 2, high: p + 10, low: p - 10, close: p, volume: 1e6 };
  });
  const series: CandleSeries = { symbol, timeframe: "1D", candles, source, fetchedAt: now };
  const quote: Quote = { stock: { symbol, name: symbol, market: "IDX", sector: "-", currency: "IDR" }, lastPrice: candles[149].close, change: 0, changePct: 0, timestamp: now, source };
  const technical = runTechnicalAnalysis(series, "IDX", "balanced");
  const news = runNewsResearch([], source);
  const risk = runRiskCheck({ technical, candles, quote, mode: "balanced", market: "IDX" });
  const review = runReview({ news, technical, risk, quote });
  const request = { symbol, market: "IDX" as const, timeframe: "1D" as const, mode: "balanced" as const, origin: "autopilot" as const };
  const r = buildFinalReport({ id: `r-${symbol}`, request, quote, news, technical, risk, review });
  return { ...r, status: "BUY_SETUP", entryZone: technical.entryZone, stopLoss: technical.stopLoss, riskReward: risk.riskReward };
}

describe("autopilot → Entry Radar", () => {
  it("replaces the radar row when a later analysis finds a buy", async () => {
    useOffice.setState({ screener: screener([item("AAA", "avoid", 10, -0.5), item("BBB", "later", 40)]), run: null, reports: [] });
    const report = buyReport("AAA");
    streamed.events = [{ type: "run_completed", runId: "x", report, at: Date.now() }];
    await useOffice.getState().startAnalysis(report.request);
    const row = useOffice.getState().screener!.items.find((i) => i.stock.symbol === "AAA")!;
    expect(row.status).toBe("BUY_SETUP");
    expect(["today", "next_session"]).toContain(row.plan.timing);
    expect(row.refreshedBy).toBe("autopilot");
    expect(useOffice.getState().screener!.items).toHaveLength(2);
  });

  it("ignores analyses that are not comparable to the scan (other timeframe)", async () => {
    useOffice.setState({ screener: screener([item("AAA", "avoid", 10)]), run: null });
    const report = buyReport("AAA");
    const weekly = { ...report, id: "w", request: { ...report.request, timeframe: "1W" as const } };
    streamed.events = [{ type: "run_completed", runId: "y", report: weekly, at: Date.now() }];
    await useOffice.getState().startAnalysis(weekly.request);
    expect(useOffice.getState().screener!.items[0].plan.timing).toBe("avoid");
  });
});
