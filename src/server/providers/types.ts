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
  getStock(symbol: string): Promise<StockInfo | null>;
  getQuote(symbol: string): Promise<Quote>;
  getCandles(symbol: string, timeframe: Timeframe, limit: number): Promise<CandleSeries>;
}

export interface NewsProvider {
  readonly source: DataSource;
  getNews(symbol: string, limit: number): Promise<NewsItem[]>;
}

export class SymbolNotFoundError extends Error {
  constructor(symbol: string) {
    super(`Simbol "${symbol}" tidak ditemukan di sumber data.`);
    this.name = "SymbolNotFoundError";
  }
}
