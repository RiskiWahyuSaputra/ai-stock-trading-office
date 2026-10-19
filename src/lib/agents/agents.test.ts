import { describe, expect, it } from "vitest";
import { validateLevels } from "@/lib/analysis/risk";
import { FinalReportSchema, type CandleSeries } from "@/lib/domain/schemas";
import { DemoMarketProvider } from "@/server/providers/demo-market";
import { DemoNewsProvider } from "@/server/providers/demo-news";
import { DEMO_UNIVERSE } from "@/server/providers/demo-universe";
import { buildFinalReport, decideStatus } from "./final-officer";
import { classify, runNewsResearch } from "./news-researcher";
import { runRiskCheck } from "./risk-manager";
import { runReview } from "./signal-reviewer";
import { runTechnicalAnalysis } from "./technical-analyst";

const market = new DemoMarketProvider([0, 0]);
const newsP = new DemoNewsProvider([0, 0]);

describe("news researcher", () => {
  it("classifies obvious headlines", () => {
    expect(classify("X reports quarterly earnings above analyst consensus").sentiment).toBe("positive");
    expect(classify("X faces regulatory investigation").sentiment).toBe("negative");
    expect(classify("X to hold annual general meeting").sentiment).toBe("neutral");
  });
});

describe("technical analyst", () => {
  it("refuses to produce levels with too little data", async () => {
    const s = await market.getCandles("BBCA", "1D", 30);
    const t = runTechnicalAnalysis(s, "IDX", "balanced");
    expect(t.direction).toBe("neutral");
    expect(t.entryZone).toBeNull();
  });

  it("produces ordered levels for synthetic uptrend", () => {
    const candles = Array.from({ length: 150 }, (_, i) => {
      const p = 1000 + i * 5 + 20 * Math.sin(i / 4);
      return { time: 1_700_000_000_000 + i * 86_400_000, open: p - 2, high: p + 10, low: p - 10, close: p, volume: 1e6 };
    });
    const series: CandleSeries = { symbol: "T", timeframe: "1D", candles, source: { id: "t", name: "t", isDemo: true }, fetchedAt: Date.now() };
    const t = runTechnicalAnalysis(series, "IDX", "balanced");
    expect(t.direction).toBe("bullish");
    expect(validateLevels("long", t.entryZone!, t.stopLoss!, t.takeProfits).valid).toBe(true);
  });
});

describe("full pipeline over demo universe", () => {
  for (const stock of DEMO_UNIVERSE) {
    for (const tf of ["1D", "4h"] as const) {
      it(`${stock.symbol} ${tf} yields a schema-valid, consistent report`, async () => {
        const [series, quote, items] = await Promise.all([
          market.getCandles(stock.symbol, tf, 250),
          market.getQuote(stock.symbol),
          newsP.getNews(stock.symbol, 8),
        ]);
        const news = runNewsResearch(items, newsP.source);
        const technical = runTechnicalAnalysis(series, stock.market, "balanced");
        const risk = runRiskCheck({ technical, candles: series.candles, quote, mode: "balanced", market: stock.market });
        const review = runReview({ news, technical, risk, quote });
        const report = buildFinalReport({
          id: "x",
          request: { symbol: stock.symbol, market: stock.market, timeframe: tf, mode: "balanced" },
          quote, news, technical, risk, review,
        });
        FinalReportSchema.parse(report);
        expect(report.isDemo).toBe(true);
        expect(report.status).toBe(decideStatus(technical, risk, review));
        if (report.status === "BUY_SETUP" || report.status === "SELL_SETUP") {
          const side = report.status === "BUY_SETUP" ? "long" : "short";
          expect(validateLevels(side, report.entryZone!, report.stopLoss!, report.takeProfits).valid).toBe(true);
          expect(report.riskReward[1]).toBeGreaterThanOrEqual(1.5);
        } else {
          expect(report.entryZone).toBeNull();
        }
      });
    }
  }
});

describe("news researcher (Bahasa Indonesia)", () => {
  it("classifies Indonesian headlines", () => {
    expect(classify("Laba bersih BBCA naik 12% di kuartal III").sentiment).toBe("positive");
    expect(classify("BCA kembali gaspol buyback saham BBCA").sentiment).toBe("positive");
    expect(classify("Saham GOTO anjlok, asing net sell besar").sentiment).toBe("negative");
    expect(classify("Emiten X disuspensi bursa").sentiment).toBe("negative");
    expect(classify("Jadwal RUPS BBRI bulan depan").sentiment).toBe("neutral");
  });
});
