import "server-only";
import YahooFinance from "yahoo-finance2";
import type { CandleSeries, DataSource, Market, Quote, StockInfo, Timeframe } from "@/lib/domain/schemas";
import { DEMO_UNIVERSE } from "./demo-universe";
import { ProviderError, SymbolNotFoundError, type MarketDataProvider } from "./types";
import { aggregateHourly, chartRequest, cleanBars, fromYahooSymbol, toYahooSymbol } from "./yahoo-helpers";

export const yahoo = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const QUOTE_TTL = 30_000;
const CANDLE_TTL = 120_000;
const INFO_TTL = 6 * 3_600_000;

/** Tiny TTL cache so the office does not hammer an unofficial endpoint. */
class TtlCache<T> {
  private map = new Map<string, { at: number; value: Promise<T> }>();
  constructor(private ttl: number) {}
  get(key: string, load: () => Promise<T>) {
    const hit = this.map.get(key);
    if (hit && Date.now() - hit.at < this.ttl) return hit.value;
    const value = load();
    this.map.set(key, { at: Date.now(), value });
    value.catch(() => this.map.delete(key));
    return value;
  }
}

function isNotFound(err: unknown) {
  const msg = String((err as Error)?.message ?? err);
  return /not found|no data|delisted|Quote not found|No fundamentals/i.test(msg);
}

function wrap(err: unknown, symbol: string): never {
  if (err instanceof SymbolNotFoundError || err instanceof ProviderError) throw err;
  if (isNotFound(err)) throw new SymbolNotFoundError(symbol);
  throw new ProviderError(`Gagal mengambil data ${symbol} dari Yahoo Finance: ${(err as Error)?.message ?? "kesalahan jaringan"}`);
}

/**
 * Real market data from Yahoo Finance (unofficial API via `yahoo-finance2`).
 * Prices are delayed by the exchange (IDX ≈ 10 minutes) and are fetched on
 * demand — this provider does not stream, so price alerts stay disabled.
 */
export class YahooMarketProvider implements MarketDataProvider {
  readonly source: DataSource = { id: "yahoo", name: "Yahoo Finance (delayed)", isDemo: false };
  readonly supportsLivePrices = false;

  private quotes = new TtlCache<Quote>(QUOTE_TTL);
  private candles = new TtlCache<CandleSeries>(CANDLE_TTL);
  private infos = new TtlCache<StockInfo | null>(INFO_TTL);

  /** Without an explicit market, IDX is tried first (the app's home market). */
  private async resolveMarket(symbol: string, market?: Market): Promise<Market> {
    if (market) return market;
    if (await this.getStock(symbol, "IDX")) return "IDX";
    if (await this.getStock(symbol, "US")) return "US";
    throw new SymbolNotFoundError(symbol);
  }

  async searchSymbols(query: string, market?: Market): Promise<StockInfo[]> {
    const q = query.trim();
    if (q.length === 0) {
      // No query yet: suggest well-known listings (names only, no prices).
      return DEMO_UNIVERSE.filter((s) => !market || s.market === market).map(({ symbol, name, market: m, sector, currency }) => ({
        symbol,
        name,
        market: m,
        sector,
        currency,
      }));
    }
    const queries = market === "IDX" && !q.includes(".") ? [q, `${q}.JK`] : [q];
    try {
      const results = await Promise.all(queries.map((x) => yahoo.search(x, { quotesCount: 10, newsCount: 0 })));
      const seen = new Set<string>();
      const out: StockInfo[] = [];
      for (const r of results.flatMap((x) => x.quotes)) {
        const quote = r as { symbol?: string; quoteType?: string; exchange?: string; shortname?: string; longname?: string; sector?: string; sectorDisp?: string };
        if (!quote.symbol || quote.quoteType !== "EQUITY") continue;
        const mapped = fromYahooSymbol(quote.symbol, quote.exchange);
        if (!mapped || (market && mapped.market !== market) || seen.has(`${mapped.market}:${mapped.symbol}`)) continue;
        seen.add(`${mapped.market}:${mapped.symbol}`);
        out.push({
          symbol: mapped.symbol,
          name: quote.longname ?? quote.shortname ?? mapped.symbol,
          market: mapped.market,
          sector: quote.sectorDisp ?? quote.sector ?? "Equity",
          currency: mapped.market === "IDX" ? "IDR" : "USD",
        });
      }
      return out.slice(0, 10);
    } catch (err) {
      throw new ProviderError(`Pencarian simbol gagal: ${(err as Error).message}`);
    }
  }

  getStock(symbol: string, market?: Market): Promise<StockInfo | null> {
    if (!market) return this.resolveMarket(symbol).then((m) => this.getStock(symbol, m)).catch(() => null);
    const ySym = toYahooSymbol(symbol, market);
    return this.infos.get(ySym, async () => {
      try {
        const q = await yahoo.quote(ySym);
        if (!q || q.quoteType !== "EQUITY" || !q.regularMarketPrice) return null;
        let sector = "Equity";
        try {
          const summary = await yahoo.quoteSummary(ySym, { modules: ["assetProfile"] });
          sector = summary.assetProfile?.sector ?? sector;
        } catch {
          // Sector is cosmetic; keep the default when the profile is missing.
        }
        return {
          symbol: symbol.toUpperCase(),
          name: q.longName ?? q.shortName ?? symbol.toUpperCase(),
          market,
          sector,
          currency: market === "IDX" ? "IDR" : "USD",
        };
      } catch (err) {
        if (isNotFound(err)) return null;
        wrap(err, symbol);
      }
    });
  }

  async getQuote(symbol: string, market?: Market): Promise<Quote> {
    const m = await this.resolveMarket(symbol, market);
    const ySym = toYahooSymbol(symbol, m);
    return this.quotes.get(ySym, async () => {
      try {
        const [q, stock] = await Promise.all([yahoo.quote(ySym), this.getStock(symbol, m)]);
        if (!q?.regularMarketPrice || !stock) throw new SymbolNotFoundError(symbol);
        const time = q.regularMarketTime ? new Date(q.regularMarketTime).getTime() : Date.now();
        return {
          stock,
          lastPrice: q.regularMarketPrice,
          change: q.regularMarketChange ?? 0,
          changePct: Math.round((q.regularMarketChangePercent ?? 0) * 100) / 100,
          timestamp: time,
          source: this.source,
          marketOpen: q.marketState === "REGULAR",
          delayMinutes: q.exchangeDataDelayedBy ?? undefined,
        };
      } catch (err) {
        wrap(err, symbol);
      }
    });
  }

  async getCandles(symbol: string, timeframe: Timeframe, limit: number, market?: Market): Promise<CandleSeries> {
    const m = await this.resolveMarket(symbol, market);
    const ySym = toYahooSymbol(symbol, m);
    return this.candles.get(`${ySym}|${timeframe}|${limit}`, async () => {
      try {
        const { interval, days } = chartRequest(timeframe, limit);
        const res = await yahoo.chart(ySym, { period1: new Date(Date.now() - days * 86_400_000), interval });
        let candles = cleanBars(res.quotes);
        if (timeframe === "4h") candles = aggregateHourly(candles, 4, res.meta.exchangeTimezoneName ?? "UTC");
        if (candles.length === 0) throw new SymbolNotFoundError(symbol);
        return { symbol: symbol.toUpperCase(), timeframe, candles: candles.slice(-limit), source: this.source, fetchedAt: Date.now() };
      } catch (err) {
        wrap(err, symbol);
      }
    });
  }
}
