import type { Candle, CandleSeries, DataSource, Market, Quote, StockInfo, Timeframe } from "@/lib/domain/schemas";
import { roundToTick } from "@/lib/analysis/risk";
import { DEMO_UNIVERSE, findDemoStock, type DemoStock } from "./demo-universe";
import { gaussian, hashString, mulberry32, sleep } from "./random";
import { SymbolNotFoundError, type MarketDataProvider } from "./types";

export const TIMEFRAME_MS: Record<Timeframe, number> = {
  "1h": 3_600_000,
  "4h": 4 * 3_600_000,
  "1D": 86_400_000,
  "1W": 7 * 86_400_000,
};

const BARS_PER_YEAR: Record<Timeframe, number> = { "1h": 252 * 6, "4h": 252 * 1.5, "1D": 252, "1W": 52 };

/**
 * DEMO market data: a seeded random walk per symbol/timeframe that changes
 * daily. Every value it returns is SIMULATED and tagged `isDemo: true`.
 * It also adds a small artificial latency so the workflow behaves like a
 * networked provider.
 */
export class DemoMarketProvider implements MarketDataProvider {
  readonly source: DataSource = { id: "demo-market", name: "DEMO Simulated Market Feed", isDemo: true };
  readonly supportsLivePrices = false;

  constructor(private latencyMs: [number, number] = [350, 900]) {}

  private async latency() {
    const [min, max] = this.latencyMs;
    await sleep(min + Math.random() * (max - min));
  }

  async searchSymbols(query: string, market?: Market): Promise<StockInfo[]> {
    const q = query.trim().toUpperCase();
    return DEMO_UNIVERSE.filter(
      (s) =>
        (!market || s.market === market) &&
        (q === "" || s.symbol.includes(q) || s.name.toUpperCase().includes(q)),
    )
      .slice(0, 10)
      .map(toInfo);
  }

  async getStock(symbol: string) {
    const s = findDemoStock(symbol);
    return s ? toInfo(s) : null;
  }

  async getCandles(symbol: string, timeframe: Timeframe, limit: number): Promise<CandleSeries> {
    await this.latency();
    const stock = findDemoStock(symbol);
    if (!stock) throw new SymbolNotFoundError(symbol);
    return {
      symbol: stock.symbol,
      timeframe,
      candles: simulate(stock, timeframe, limit, Date.now()),
      source: this.source,
      fetchedAt: Date.now(),
    };
  }

  async getQuote(symbol: string): Promise<Quote> {
    await this.latency();
    const stock = findDemoStock(symbol);
    if (!stock) throw new SymbolNotFoundError(symbol);
    const daily = simulate(stock, "1D", 2, Date.now());
    const [prev, lastBar] = daily;
    const change = lastBar.close - prev.close;
    return {
      stock: toInfo(stock),
      lastPrice: lastBar.close,
      change: round(change, stock.market === "IDX" ? 0 : 2),
      changePct: round((change / prev.close) * 100, 2),
      timestamp: Date.now(),
      source: this.source,
    };
  }
}

function toInfo({ symbol, name, market, sector, currency }: DemoStock): StockInfo {
  return { symbol, name, market, sector, currency };
}

function round(v: number, d: number) {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

/**
 * Simulate `limit` candles ending at `now`. The series is generated from a
 * fixed history length so that a shorter `limit` is a suffix of a longer one
 * (consistent across agents within the same day).
 */
function simulate(stock: DemoStock, timeframe: Timeframe, limit: number, now: number): Candle[] {
  const HISTORY = 400;
  const n = Math.min(Math.max(limit, 2), HISTORY);
  const day = Math.floor(now / 86_400_000);
  const rand = mulberry32(hashString(`${stock.symbol}|${timeframe}|${day}`));
  const stepVol = stock.vol / Math.sqrt(BARS_PER_YEAR[timeframe]);
  // Regime: a slowly changing drift so charts show real trends and ranges.
  let drift = (rand() - 0.5) * stepVol * 0.6;
  let price = stock.basePrice * (0.8 + rand() * 0.4);
  const interval = TIMEFRAME_MS[timeframe];
  const end = Math.floor(now / interval) * interval;
  const candles: Candle[] = [];

  for (let i = 0; i < HISTORY; i++) {
    if (rand() < 0.03) drift = (rand() - 0.5) * stepVol * 0.6;
    const gap = rand() < 0.04 ? gaussian(rand) * stepVol * 1.5 : 0;
    const open = price * (1 + gap);
    const ret = drift + gaussian(rand) * stepVol;
    const close = Math.max(open * (1 + ret), 1);
    const wick = Math.abs(gaussian(rand)) * stepVol * 0.5;
    const high = Math.max(open, close) * (1 + wick);
    const low = Math.min(open, close) * (1 - Math.abs(gaussian(rand)) * stepVol * 0.5);
    const volume = Math.round((1 + Math.abs(gaussian(rand))) * (stock.market === "IDX" ? 5e6 : 2e6));
    const time = end - (HISTORY - 1 - i) * interval;
    const t = (p: number, m: "up" | "down" | "nearest") => roundToTick(p, stock.market, m);
    const o = t(open, "nearest");
    const c = t(close, "nearest");
    candles.push({
      time,
      open: o,
      close: c,
      high: Math.max(t(high, "up"), o, c),
      low: Math.min(t(low, "down"), o, c),
      volume,
    });
    price = close;
  }
  return candles.slice(HISTORY - n);
}
