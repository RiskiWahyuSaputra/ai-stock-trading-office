import type { Candle, Market, Timeframe } from "@/lib/domain/schemas";

/**
 * Pure helpers for the Yahoo Finance / Google News providers. Kept free of
 * network code so they can be unit-tested with fixtures.
 */

/** Exchanges (Yahoo `exchange` codes) treated as the US market. */
export const US_EXCHANGES = new Set(["NMS", "NYQ", "NGM", "NCM", "ASE", "PCX", "BTS", "NAS", "NYS", "PNK"]);
export const IDX_EXCHANGE = "JKT";

/** App symbol → Yahoo symbol (IDX uses the `.JK` suffix, US uses `-` for share classes). */
export function toYahooSymbol(symbol: string, market: Market) {
  const s = symbol.trim().toUpperCase();
  return market === "IDX" ? `${s.replace(/\.JK$/, "")}.JK` : s.replace(/\./g, "-");
}

/** Yahoo symbol → app symbol and market, or null if it is not a supported listing. */
export function fromYahooSymbol(yahoo: string, exchange?: string): { symbol: string; market: Market } | null {
  if (yahoo.endsWith(".JK") || exchange === IDX_EXCHANGE) return { symbol: yahoo.replace(/\.JK$/, ""), market: "IDX" };
  if (exchange && !US_EXCHANGES.has(exchange)) return null;
  if (/[.=^]/.test(yahoo)) return null; // foreign suffixes, futures, indices
  return { symbol: yahoo.replace(/-/g, "."), market: "US" };
}

export interface RawBar {
  date: Date | string | number;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
}

/**
 * Drop incomplete bars, repair high/low that do not enclose open/close, sort
 * and de-duplicate by time. Nothing is interpolated or invented.
 */
export function cleanBars(rows: RawBar[]): Candle[] {
  const out = new Map<number, Candle>();
  for (const r of rows) {
    const { open, high, low, close } = r;
    if ([open, high, low, close].some((v) => v === null || v === undefined || !Number.isFinite(v) || v <= 0)) continue;
    const time = new Date(r.date).getTime();
    if (!Number.isFinite(time) || time <= 0) continue;
    const o = open as number;
    const c = close as number;
    out.set(time, {
      time,
      open: o,
      close: c,
      high: Math.max(high as number, o, c),
      low: Math.min(low as number, o, c),
      volume: Math.max(0, r.volume ?? 0),
    });
  }
  return [...out.values()].sort((a, b) => a.time - b.time);
}

const dayFormatters = new Map<string, Intl.DateTimeFormat>();
function localDay(ms: number, timeZone: string) {
  let f = dayFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    dayFormatters.set(timeZone, f);
  }
  return f.format(ms);
}

/**
 * Build 4-hour candles from hourly ones: within each exchange-local trading
 * day, consecutive hourly bars are grouped in fours (the last group of a day
 * may be shorter, as sessions do not divide evenly).
 */
export function aggregateHourly(hourly: Candle[], hours: number, timeZone: string): Candle[] {
  const out: Candle[] = [];
  let day = "";
  let count = 0;
  for (const h of hourly) {
    const d = localDay(h.time, timeZone);
    const cur = out[out.length - 1];
    if (!cur || d !== day || count >= hours) {
      out.push({ ...h });
      day = d;
      count = 1;
    } else {
      cur.high = Math.max(cur.high, h.high);
      cur.low = Math.min(cur.low, h.low);
      cur.close = h.close;
      cur.volume += h.volume;
      count++;
    }
  }
  return out;
}

/** Yahoo interval and calendar-day lookback needed for `limit` bars. */
export function chartRequest(timeframe: Timeframe, limit: number) {
  switch (timeframe) {
    case "1h":
      // ~6 bars per trading day, ~0.7 trading days per calendar day
      return { interval: "1h" as const, days: Math.min(720, Math.ceil((limit / 6) * 1.5) + 7) };
    case "4h":
      return { interval: "1h" as const, days: Math.min(720, Math.ceil((limit / 2) * 1.5) + 7) };
    case "1D":
      return { interval: "1d" as const, days: Math.ceil(limit * 1.5) + 10 };
    case "1W":
      return { interval: "1wk" as const, days: Math.ceil(limit * 7) + 30 };
  }
}

/* ------------------------------------------------------------------ */
/* Google News RSS                                                      */
/* ------------------------------------------------------------------ */

export interface RssItem {
  title: string;
  link: string;
  publishedAt: number;
  publisher: string;
}

function decode(s: string) {
  return s
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1];

/** Minimal RSS 2.0 item parser for Google News search feeds. */
export function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const body = m[1];
    const rawTitle = decode(tag(body, "title") ?? "");
    const publisher = decode(tag(body, "source") ?? "");
    const link = decode(tag(body, "link") ?? "");
    const publishedAt = Date.parse(tag(body, "pubDate") ?? "");
    if (!rawTitle || !link || !Number.isFinite(publishedAt)) continue;
    // Google appends " - Publisher" to every title.
    const suffix = publisher ? ` - ${publisher}` : "";
    const title = suffix && rawTitle.endsWith(suffix) ? rawTitle.slice(0, -suffix.length) : rawTitle;
    items.push({ title, link, publishedAt, publisher: publisher || "Google News" });
  }
  return items;
}
