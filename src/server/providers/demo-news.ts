import type { DataSource, NewsItem } from "@/lib/domain/schemas";
import { findDemoStock } from "./demo-universe";
import { hashString, mulberry32, sleep } from "./random";
import { SymbolNotFoundError, type NewsProvider } from "./types";

/**
 * DEMO news feed: headlines are generated from templates and are NOT real
 * events. Every item is prefixed with [DEMO] and tagged `isDemo: true`.
 * Sentiment is intentionally not provided — the News Researcher classifies it.
 */
const TEMPLATES = [
  "{name} reports quarterly earnings above analyst consensus",
  "{name} announces share buyback program",
  "{name} board proposes higher interim dividend",
  "{name} secures strategic partnership to expand distribution",
  "{name} upgraded by brokerage on improving margins",
  "{name} posts record revenue growth in latest quarter",
  "{name} quarterly profit falls short of expectations",
  "{name} faces regulatory investigation over reporting practices",
  "{name} downgraded as analysts cite slowing demand",
  "{name} warns of weaker outlook amid rising costs",
  "{name} hit by lawsuit from former partners",
  "{name} to hold annual general meeting next month",
  "{name} management comments on sector conditions at investor forum",
  "{name} included in index rebalancing review",
  "Sector peers of {name} move mixed as investors await macro data",
  "{name} plans rights issue to fund expansion",
];

const PUBLISHERS = ["DEMO Wire", "DEMO Market Desk", "DEMO Finance Daily", "DEMO Exchange Bulletin"];

export class DemoNewsProvider implements NewsProvider {
  readonly source: DataSource = { id: "demo-news", name: "DEMO Simulated News Feed", isDemo: true };

  constructor(private latencyMs: [number, number] = [500, 1200]) {}

  async getNews(symbol: string, limit: number): Promise<NewsItem[]> {
    const [min, max] = this.latencyMs;
    await sleep(min + Math.random() * (max - min));
    const stock = findDemoStock(symbol);
    if (!stock) throw new SymbolNotFoundError(symbol);
    const now = Date.now();
    const day = Math.floor(now / 86_400_000);
    const rand = mulberry32(hashString(`news|${stock.symbol}|${day}`));
    const pool = [...TEMPLATES];
    const count = Math.min(limit, 4 + Math.floor(rand() * 3));
    const items: NewsItem[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(rand() * pool.length);
      const [tpl] = pool.splice(idx, 1);
      const headline = tpl.replace("{name}", stock.name);
      const publishedAt = now - Math.floor(rand() * 72 * 3_600_000);
      items.push({
        id: `demo-${stock.symbol}-${day}-${i}`,
        symbol: stock.symbol,
        headline: `[DEMO] ${headline}`,
        summary: `Simulated headline for demonstration only. No such event is implied for ${stock.symbol}.`,
        publisher: PUBLISHERS[Math.floor(rand() * PUBLISHERS.length)],
        publishedAt,
        source: this.source,
      });
    }
    return items.sort((a, b) => b.publishedAt - a.publishedAt);
  }
}
