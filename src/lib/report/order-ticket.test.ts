import { describe, expect, it } from "vitest";
import type { FinalReport } from "@/lib/domain/schemas";
import { invalidatedText, orderTicketText, splitLots } from "./order-ticket";

const report = (patch: Partial<FinalReport> = {}): FinalReport =>
  ({
    id: "r1",
    request: { symbol: "BUMI", market: "IDX", timeframe: "1D", mode: "balanced" },
    quote: { stock: { name: "Bumi Resources <Tbk>" }, lastPrice: 144, timestamp: 1_761_100_000_000 },
    status: "BUY_SETUP",
    entryZone: { low: 138, high: 142 },
    stopLoss: 131,
    takeProfits: [155, 168, 180],
    riskReward: [1.4, 2.6, 3.7],
    confidence: { score: 62 },
    invalidation: ["Close harian di bawah 131"],
    risk: { position: { accountSize: 1e8, riskPct: 1, maxLoss: 1e6, shares: 4200, lots: 42, positionValue: 596_400 } },
    isDemo: false,
    disclaimer: "Bukan nasihat keuangan.",
    ...patch,
  }) as unknown as FinalReport;

describe("splitLots", () => {
  it("keeps whole lots, larger half first", () => {
    expect(splitLots(42)).toEqual([21, 21]);
    expect(splitLots(5)).toEqual([3, 2]);
  });
});

describe("orderTicketText", () => {
  it("lists entry, stop loss and TPs split by lot", () => {
    const t = orderTicketText(report());
    expect(t).toContain("BUMI — BUY SETUP");
    expect(t).toContain("<code>142</code>");
    expect(t).toContain("42 lot");
    expect(t).toContain("Stop loss: <code>131</code>");
    expect(t).toContain("TP1: <code>155</code> untuk 21 lot");
    expect(t).toContain("TP2: <code>168</code> untuk 21 lot");
    expect(t).not.toContain("DEMO");
  });

  it("escapes HTML from data", () => {
    expect(orderTicketText(report())).toContain("Bumi Resources &lt;Tbk&gt;");
  });

  it("flags demo data", () => {
    expect(orderTicketText(report({ isDemo: true }))).toContain("DEMO");
  });

  it("never suggests a short sale on IDX", () => {
    const t = orderTicketText(report({ status: "SELL_SETUP" }));
    expect(t).toContain("Short selling tidak tersedia");
    expect(t).not.toContain("Order beli");
  });
});

describe("invalidatedText", () => {
  it("tells the CEO to cancel open orders", () => {
    const t = invalidatedText(report({ status: "WAIT" }), "BUY_SETUP");
    expect(t).toContain("skenario BUY SETUP batal");
    expect(t).toContain("Batalkan order beli");
  });
});
