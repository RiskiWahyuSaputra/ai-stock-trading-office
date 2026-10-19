import "server-only";
import { DemoMarketProvider } from "./demo-market";
import { DemoNewsProvider } from "./demo-news";
import { RealNewsProvider } from "./real-news";
import type { MarketDataProvider, NewsProvider } from "./types";
import { YahooMarketProvider } from "./yahoo-market";

/**
 * Provider registry. Selected by server-side env vars so API keys never reach
 * the browser. Defaults to real data (Yahoo Finance); set the variables to
 * "demo" for the offline simulator. There is deliberately no silent fallback
 * from real to demo data.
 */
let market: MarketDataProvider | null = null;
let news: NewsProvider | null = null;

export function getMarketProvider(): MarketDataProvider {
  if (market) return market;
  const id = process.env.MARKET_DATA_PROVIDER ?? "yahoo";
  switch (id) {
    case "yahoo":
      market = new YahooMarketProvider();
      break;
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
  const id = process.env.NEWS_PROVIDER ?? "real";
  switch (id) {
    case "real":
      news = new RealNewsProvider();
      break;
    case "demo":
      news = new DemoNewsProvider();
      break;
    default:
      throw new Error(`Unknown NEWS_PROVIDER "${id}"`);
  }
  return news;
}

export { ProviderError, SymbolNotFoundError } from "./types";
export type { MarketDataProvider, NewsProvider } from "./types";
