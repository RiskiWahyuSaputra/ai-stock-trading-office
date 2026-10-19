import { describe, expect, it } from "vitest";
import { CandleSeriesSchema, NewsItemSchema, QuoteSchema } from "@/lib/domain/schemas";
import { DemoMarketProvider } from "./demo-market";
import { DemoNewsProvider } from "./demo-news";

const market = new DemoMarketProvider([0, 0]);
const news = new DemoNewsProvider([0, 0]);

describe("demo providers", () => {
  it("produces schema-valid candles labeled as demo", async () => {
    const series = CandleSeriesSchema.parse(await market.getCandles("BBCA", "1D", 120));
    expect(series.candles).toHaveLength(120);
    expect(series.source.isDemo).toBe(true);
  });

  it("shorter requests are a suffix of longer ones", async () => {
    const a = await market.getCandles("AAPL", "1D", 200);
    const b = await market.getCandles("AAPL", "1D", 50);
    expect(b.candles).toEqual(a.candles.slice(-50));
  });

  it("quote matches the last daily close", async () => {
    const q = QuoteSchema.parse(await market.getQuote("TLKM"));
    const d = await market.getCandles("TLKM", "1D", 1);
    expect(q.lastPrice).toBe(d.candles.at(-1)!.close);
  });

  it("rejects unknown symbols", async () => {
    await expect(market.getQuote("ZZZZ")).rejects.toThrow(/tidak ditemukan/);
  });

  it("labels news as demo", async () => {
    const items = await news.getNews("NVDA", 10);
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) {
      NewsItemSchema.parse(it);
      expect(it.headline.startsWith("[DEMO]")).toBe(true);
    }
  });
});
