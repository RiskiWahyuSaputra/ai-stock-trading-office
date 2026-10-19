import "server-only";
import type { DataSource, Market, NewsItem } from "@/lib/domain/schemas";
import { ProviderError, type NewsProvider } from "./types";
import { yahoo } from "./yahoo-market";
import { parseRss } from "./yahoo-helpers";

const YAHOO_NEWS: DataSource = { id: "yahoo-news", name: "Yahoo Finance News", isDemo: false };
const GOOGLE_NEWS: DataSource = { id: "google-news", name: "Google News RSS (ID)", isDemo: false };
const LOOKBACK_DAYS = 7;
const TTL = 5 * 60_000;

/**
 * Real headlines. US symbols use Yahoo Finance's ticker news; IDX symbols use
 * a Google News RSS search in Indonesian, because Yahoo carries almost no
 * IDX news. Only headline, publisher, time and link are used — article bodies
 * are not fetched.
 */
export class RealNewsProvider implements NewsProvider {
  readonly source: DataSource = { id: "real-news", name: "Yahoo Finance News / Google News RSS", isDemo: false };
  private cache = new Map<string, { at: number; items: Promise<NewsItem[]> }>();

  getNews(symbol: string, limit: number, market: Market = "IDX"): Promise<NewsItem[]> {
    const key = `${market}:${symbol}:${limit}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return hit.items;
    const items = (market === "US" ? this.yahooNews(symbol, limit) : this.googleNews(symbol, limit)).catch((err) => {
      this.cache.delete(key);
      throw err instanceof ProviderError ? err : new ProviderError(`Gagal mengambil berita ${symbol}: ${(err as Error).message}`);
    });
    this.cache.set(key, { at: Date.now(), items });
    return items;
  }

  private async yahooNews(symbol: string, limit: number): Promise<NewsItem[]> {
    const res = await yahoo.search(symbol, { quotesCount: 0, newsCount: Math.max(limit * 2, 10) });
    const since = Date.now() - LOOKBACK_DAYS * 86_400_000;
    const sym = symbol.toUpperCase();
    return res.news
      .filter((n) => !n.relatedTickers || n.relatedTickers.length === 0 || n.relatedTickers.includes(sym))
      .map((n) => ({
        id: `yahoo-${n.uuid}`,
        symbol: sym,
        headline: n.title,
        summary: "",
        publisher: n.publisher,
        url: n.link,
        publishedAt: new Date(n.providerPublishTime).getTime(),
        source: YAHOO_NEWS,
      }))
      .filter((n) => n.publishedAt >= since)
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, limit);
  }

  private async googleNews(symbol: string, limit: number): Promise<NewsItem[]> {
    const sym = symbol.toUpperCase();
    const q = `"${sym}" saham when:${LOOKBACK_DAYS}d`;
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=id&gl=ID&ceid=ID:id`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (AI Stock Trading Office)" }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new ProviderError(`Google News merespons HTTP ${res.status}.`);
    const items = parseRss(await res.text())
      // The query matches the ticker anywhere; keep headlines that name it.
      .filter((i) => new RegExp(`\\b${sym}\\b`, "i").test(i.title))
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, limit);
    return items.map((i, idx) => ({
      id: `gnews-${sym}-${i.publishedAt}-${idx}`,
      symbol: sym,
      headline: i.title,
      summary: "",
      publisher: i.publisher,
      url: i.link,
      publishedAt: i.publishedAt,
      source: GOOGLE_NEWS,
    }));
  }
}
