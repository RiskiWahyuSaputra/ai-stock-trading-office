import type { StockInfo } from "@/lib/domain/schemas";

/**
 * DEMO universe. Base prices are illustrative seeds for the simulator only;
 * they are not quotes and must never be presented as market data.
 */
export interface DemoStock extends StockInfo {
  basePrice: number;
  /** Annualised volatility used by the simulator. */
  vol: number;
}

export const DEMO_UNIVERSE: DemoStock[] = [
  { symbol: "BBCA", name: "Bank Central Asia Tbk", market: "IDX", sector: "Financials", currency: "IDR", basePrice: 9500, vol: 0.22 },
  { symbol: "BBRI", name: "Bank Rakyat Indonesia (Persero) Tbk", market: "IDX", sector: "Financials", currency: "IDR", basePrice: 4300, vol: 0.3 },
  { symbol: "BMRI", name: "Bank Mandiri (Persero) Tbk", market: "IDX", sector: "Financials", currency: "IDR", basePrice: 6100, vol: 0.28 },
  { symbol: "TLKM", name: "Telkom Indonesia (Persero) Tbk", market: "IDX", sector: "Communication", currency: "IDR", basePrice: 3100, vol: 0.27 },
  { symbol: "ASII", name: "Astra International Tbk", market: "IDX", sector: "Industrials", currency: "IDR", basePrice: 5000, vol: 0.28 },
  { symbol: "GOTO", name: "GoTo Gojek Tokopedia Tbk", market: "IDX", sector: "Technology", currency: "IDR", basePrice: 70, vol: 0.6 },
  { symbol: "ANTM", name: "Aneka Tambang Tbk", market: "IDX", sector: "Materials", currency: "IDR", basePrice: 1500, vol: 0.45 },
  { symbol: "UNVR", name: "Unilever Indonesia Tbk", market: "IDX", sector: "Consumer Staples", currency: "IDR", basePrice: 2000, vol: 0.32 },
  { symbol: "ADRO", name: "Alamtri Resources Indonesia Tbk", market: "IDX", sector: "Energy", currency: "IDR", basePrice: 2600, vol: 0.4 },
  { symbol: "ICBP", name: "Indofood CBP Sukses Makmur Tbk", market: "IDX", sector: "Consumer Staples", currency: "IDR", basePrice: 11000, vol: 0.24 },
  { symbol: "AAPL", name: "Apple Inc.", market: "US", sector: "Technology", currency: "USD", basePrice: 230, vol: 0.26 },
  { symbol: "MSFT", name: "Microsoft Corporation", market: "US", sector: "Technology", currency: "USD", basePrice: 430, vol: 0.24 },
  { symbol: "NVDA", name: "NVIDIA Corporation", market: "US", sector: "Technology", currency: "USD", basePrice: 140, vol: 0.5 },
  { symbol: "TSLA", name: "Tesla, Inc.", market: "US", sector: "Consumer Discretionary", currency: "USD", basePrice: 250, vol: 0.6 },
  { symbol: "AMZN", name: "Amazon.com, Inc.", market: "US", sector: "Consumer Discretionary", currency: "USD", basePrice: 190, vol: 0.32 },
  { symbol: "GOOGL", name: "Alphabet Inc.", market: "US", sector: "Communication", currency: "USD", basePrice: 170, vol: 0.3 },
  { symbol: "META", name: "Meta Platforms, Inc.", market: "US", sector: "Communication", currency: "USD", basePrice: 560, vol: 0.38 },
];

export function findDemoStock(symbol: string) {
  return DEMO_UNIVERSE.find((s) => s.symbol === symbol.toUpperCase()) ?? null;
}
