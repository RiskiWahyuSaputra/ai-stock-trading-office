import { describe, expect, it } from "vitest";
import { aggregateHourly, chartRequest, cleanBars, fromYahooSymbol, parseRss, searchDirectory, toYahooSymbol } from "./yahoo-helpers";

describe("symbol mapping", () => {
  it("maps IDX and US symbols to Yahoo", () => {
    expect(toYahooSymbol("bbca", "IDX")).toBe("BBCA.JK");
    expect(toYahooSymbol("BBCA.JK", "IDX")).toBe("BBCA.JK");
    expect(toYahooSymbol("BRK.B", "US")).toBe("BRK-B");
  });

  it("maps Yahoo listings back and rejects unsupported ones", () => {
    expect(fromYahooSymbol("TLKM.JK", "JKT")).toEqual({ symbol: "TLKM", market: "IDX" });
    expect(fromYahooSymbol("BRK-B", "NYQ")).toEqual({ symbol: "BRK.B", market: "US" });
    expect(fromYahooSymbol("TLK", "NYQ")).toEqual({ symbol: "TLK", market: "US" });
    expect(fromYahooSymbol("SAP.DE", "GER")).toBeNull();
    expect(fromYahooSymbol("ES=F", "CME")).toBeNull();
  });
});

describe("cleanBars", () => {
  it("drops incomplete bars, repairs high/low, sorts and de-duplicates", () => {
    const out = cleanBars([
      { date: "2026-10-02T02:00:00Z", open: 10, high: 9, low: 11, close: 10.5, volume: 5 },
      { date: "2026-10-01T02:00:00Z", open: 9, high: 10, low: 8, close: 9.5, volume: null },
      { date: "2026-10-03T02:00:00Z", open: null, high: 10, low: 8, close: 9 },
      { date: "2026-10-02T02:00:00Z", open: 10, high: 11, low: 9.5, close: 10.8, volume: 7 },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].volume).toBe(0);
    expect(out[1]).toMatchObject({ open: 10, high: 11, low: 9.5, close: 10.8 });
  });
});

describe("aggregateHourly", () => {
  it("groups hourly bars in fours within each exchange-local day", () => {
    // IDX session hours in WIB (UTC+7): 09,10,11,13,14,15 on two days
    const hours = ["02", "03", "04", "06", "07", "08"];
    const hourly = cleanBars(
      ["2026-10-15", "2026-10-16"].flatMap((d) =>
        hours.map((h, i) => ({ date: `${d}T${h}:00:00Z`, open: 100 + i, high: 101 + i, low: 99 + i, close: 100.5 + i, volume: 10 })),
      ),
    );
    const out = aggregateHourly(hourly, 4, "Asia/Jakarta");
    expect(out).toHaveLength(4);
    expect(out[0]).toMatchObject({ open: 100, close: 103.5, high: 104, low: 99, volume: 40 });
    expect(out[1]).toMatchObject({ open: 104, close: 105.5, volume: 20 });
  });
});

describe("chartRequest", () => {
  it("chooses intervals and enough lookback", () => {
    expect(chartRequest("4h", 250).interval).toBe("1h");
    expect(chartRequest("1D", 250).days).toBeGreaterThanOrEqual(365);
    expect(chartRequest("1h", 400).days).toBeLessThanOrEqual(720);
  });
});

describe("parseRss", () => {
  it("parses Google News items and strips the publisher suffix", () => {
    const xml = `<rss><channel><item><title>BCA Gaspol Buyback Saham BBCA &amp; Dividen - Pasardana</title><link>https://news.google.com/a</link><pubDate>Sun, 18 Oct 2026 07:00:00 GMT</pubDate><source url="https://pasardana.id">Pasardana</source></item><item><title>broken</title></item></channel></rss>`;
    const items = parseRss(xml);
    expect(items).toEqual([
      { title: "BCA Gaspol Buyback Saham BBCA & Dividen", link: "https://news.google.com/a", publishedAt: Date.parse("Sun, 18 Oct 2026 07:00:00 GMT"), publisher: "Pasardana" },
    ]);
  });
});

describe("searchDirectory", () => {
  const items = [
    { symbol: "BBRI", name: "PT Bank Rakyat Indonesia (Persero) Tbk", market: "IDX", sector: "Financial Services", currency: "IDR" },
    { symbol: "BBCA", name: "PT Bank Central Asia Tbk", market: "IDX", sector: "Financial Services", currency: "IDR" },
    { symbol: "TLKM", name: "PT Telkom Indonesia (Persero) Tbk", market: "IDX", sector: "Communication Services", currency: "IDR" },
    { symbol: "TLK", name: "Perusahaan Perseroan (Persero) PT Telekomunikasi Indonesia Tbk", market: "US", sector: "Communication Services", currency: "USD" },
  ] as const;

  it("matches ticker prefixes, which Yahoo search does not", () => {
    expect(searchDirectory([...items], "bb", "IDX", 10).map((s) => s.symbol)).toEqual(["BBCA", "BBRI"]);
  });

  it("ranks exact code first, then prefix, then name", () => {
    expect(searchDirectory([...items], "TLK", undefined, 10).map((s) => s.symbol)).toEqual(["TLK", "TLKM"]);
    expect(searchDirectory([...items], "central", "IDX", 10).map((s) => s.symbol)).toEqual(["BBCA"]);
  });

  it("returns the curated order for an empty query", () => {
    expect(searchDirectory([...items], "", "IDX", 2).map((s) => s.symbol)).toEqual(["BBRI", "BBCA"]);
  });
});
