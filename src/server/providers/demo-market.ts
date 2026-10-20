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

  async getStock(symbol: string, market?: Market) {
    const s = findDemoStock(symbol);
    return s && (!market || s.market === market) ? toInfo(s) : null;
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

  getQuotes(symbols: string[]): Promise<Quote[]> {
    return Promise.all(symbols.filter((s) => findDemoStock(s)).map((s) => this.getQuote(s)));
  }

  listUniverse(market: Market): StockInfo[] {
    return DEMO_UNIVERSE.filter((s) => s.market === market).map(toInfo);
  }
}

function toInfo({ symbol, name, market, sector, currency }: DemoStock): StockInfo {
  return { symbol, name, market, sector, currency };
}

function round(v: number, d: number) {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

const HOUR = 3_600_000;
const MAX_BARS = 400;
const HISTORY_HOURS = MAX_BARS * 168 + 168;
const cache = new Map<string, Candle[]>();

/**
 * One hourly path per symbol per day; every timeframe is aggregated from it,
 * so 1h/4h/1D/1W candles and the quote always agree with each other.
 * The path is generated forward as a mean-reverting log-price process with
 * slowly changing drift regimes and rare jumps, then anchored so the latest
 * close sits near the symbol's base price.
 */
function hourlyPath(stock: DemoStock, now: number): Candle[] {
  const day = Math.floor(now / 86_400_000);
  const end = Math.floor(now / HOUR) * HOUR;
  const key = `${stock.symbol}|${day}|${end}`;
  const hit = cache.get(key);
  if (hit) return hit;
  for (const k of cache.keys()) if (k.startsWith(`${stock.symbol}|`)) cache.delete(k);

  const rand = mulberry32(hashString(`${stock.symbol}|${day}`));
  const sigma = stock.vol / Math.sqrt(BARS_PER_YEAR["1h"] * 4);
  const theta = 1 / (HISTORY_HOURS / 6);
  let drift = 0;
  let x = 0;
  const logs: { o: number; h: number; l: number; c: number }[] = [];
  for (let i = 0; i < HISTORY_HOURS; i++) {
    if (rand() < 0.002) drift = (rand() - 0.5) * sigma * 0.25;
    const jump = rand() < 0.0015 ? gaussian(rand) * sigma * 12 : 0;
    const o = x + jump;
    const c = o + theta * (0 - o) + drift + gaussian(rand) * sigma;
    const h = Math.max(o, c) + Math.abs(gaussian(rand)) * sigma * 0.6;
    const l = Math.min(o, c) - Math.abs(gaussian(rand)) * sigma * 0.6;
    logs.push({ o, h, l, c });
    x = c;
  }
  const anchor = stock.basePrice * (0.85 + rand() * 0.3);
  const shift = Math.log(anchor) - x;
  const t = (v: number, m: "up" | "down" | "nearest") => roundToTick(Math.max(Math.exp(v + shift), 1), stock.market, m);
  const baseVol = stock.market === "IDX" ? 8e5 : 3e5;
  const out: Candle[] = logs.map((b, i) => {
    const o = t(b.o, "nearest");
    const c = t(b.c, "nearest");
    return {
      time: end - (HISTORY_HOURS - 1 - i) * HOUR,
      open: o,
      close: c,
      high: Math.max(t(b.h, "up"), o, c),
      low: Math.min(t(b.l, "down"), o, c),
      volume: Math.round(baseVol * (1 + Math.abs(gaussian(rand)) + Math.abs(b.c - b.o) / sigma)),
    };
  });
  cache.set(key, out);
  return out;
}

/** Aggregate the hourly path into `limit` candles of the given timeframe. */
function simulate(stock: DemoStock, timeframe: Timeframe, limit: number, now: number): Candle[] {
  const hourly = hourlyPath(stock, now);
  const interval = TIMEFRAME_MS[timeframe];
  const n = Math.min(Math.max(limit, 1), MAX_BARS);
  if (interval === HOUR) return hourly.slice(-n);
  const out: Candle[] = [];
  for (const h of hourly) {
    const bucket = Math.floor(h.time / interval) * interval;
    const cur = out[out.length - 1];
    if (!cur || cur.time !== bucket) {
      out.push({ ...h, time: bucket });
    } else {
      cur.high = Math.max(cur.high, h.high);
      cur.low = Math.min(cur.low, h.low);
      cur.close = h.close;
      cur.volume += h.volume;
    }
  }
  return out.slice(-n);
}
