import type {
  CandleSeries,
  DataSource,
  Market,
  NewsItem,
  Quote,
  StockInfo,
  Timeframe,
} from "@/lib/domain/schemas";

/**
 * Provider contracts. A real provider (e.g. a broker or market-data API)
 * implements these and is selected in `./index.ts` via environment variables.
 */
export interface MarketDataProvider {
  readonly source: DataSource;
  /** Whether this provider streams live prices (required for price alerts). */
  readonly supportsLivePrices: boolean;
  searchSymbols(query: string, market?: Market): Promise<StockInfo[]>;
  /** `market` disambiguates symbols listed on several exchanges. */
  getStock(symbol: string, market?: Market): Promise<StockInfo | null>;
  getQuote(symbol: string, market?: Market): Promise<Quote>;
  /** Batched quotes for screening; symbols without a quote are left out of the result. */
  getQuotes(symbols: string[], market: Market): Promise<Quote[]>;
  /** Listings the Entry Radar scans when no explicit list is given. */
  listUniverse(market: Market): StockInfo[];
  getCandles(symbol: string, timeframe: Timeframe, limit: number, market?: Market): Promise<CandleSeries>;
}

export interface NewsProvider {
  readonly source: DataSource;
  getNews(symbol: string, limit: number, market?: Market): Promise<NewsItem[]>;
}

/** Upstream provider failed (network, rate limit, bad payload). */
export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

export class SymbolNotFoundError extends Error {
  constructor(symbol: string) {
    super(`Simbol "${symbol}" tidak ditemukan di sumber data.`);
    this.name = "SymbolNotFoundError";
  }
}
