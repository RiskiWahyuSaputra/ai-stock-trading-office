import "server-only";
import { DemoMarketProvider } from "./demo-market";
import { DemoNewsProvider } from "./demo-news";
import type { MarketDataProvider, NewsProvider } from "./types";

/**
 * Provider registry. Selected by server-side env vars so API keys never reach
 * the browser. Add real implementations here (e.g. `case "alphavantage"`).
 */
let market: MarketDataProvider | null = null;
let news: NewsProvider | null = null;

export function getMarketProvider(): MarketDataProvider {
  if (market) return market;
  const id = process.env.MARKET_DATA_PROVIDER ?? "demo";
  switch (id) {
    case "demo":
      market = new DemoMarketProvider();
      break;
    default:
      throw new Error(`Unknown MARKET_DATA_PROVIDER "${id}"`);
  }
  return market;
}

export function getNewsProvider(): NewsProvider {
  if (news) return news;
  const id = process.env.NEWS_PROVIDER ?? "demo";
  switch (id) {
    case "demo":
      news = new DemoNewsProvider();
      break;
    default:
      throw new Error(`Unknown NEWS_PROVIDER "${id}"`);
  }
  return news;
}

export { SymbolNotFoundError } from "./types";
export type { MarketDataProvider, NewsProvider } from "./types";
