"use client";

import { useState } from "react";
import { StockSearch } from "@/components/analysis/StockSearch";
import { NewsFeed } from "@/components/news/NewsFeed";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/Segmented";
import type { Market } from "@/lib/domain/schemas";
import { useOffice } from "@/lib/store/office-store";
import { cn } from "@/lib/utils";

export default function NewsCenterPage() {
  const watchlist = useOffice((s) => s.watchlist);
  const [market, setMarket] = useState<Market>("IDX");
  const [query, setQuery] = useState("");
  const [symbol, setSymbol] = useState(watchlist[0]?.symbol ?? "BBCA");

  return (
    <div className="page-enter space-y-4 p-3 sm:p-4">
      <PageHeader title="News Center" description="Ruang kerja News Researcher: berita per saham beserta sentimen dan dampaknya." />
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Panel className="h-fit space-y-4 p-4">
          <Segmented label="Pasar" value={market} onChange={setMarket} options={[{ value: "IDX", label: "IDX" }, { value: "US", label: "US" }]} />
          <StockSearch
            value={query}
            market={market}
            onChange={setQuery}
            onSelect={(s) => {
              setSymbol(s.symbol);
              setQuery("");
            }}
          />
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted">Watchlist</div>
            <div className="flex flex-wrap gap-1.5">
              {watchlist.map((w) => (
                <button
                  key={w.symbol}
                  onClick={() => setSymbol(w.symbol)}
                  className={cn("rounded-md border px-2 py-1 text-xs font-medium", symbol === w.symbol ? "border-accent text-accent" : "border-line-strong text-muted hover:text-fg")}
                >
                  {w.symbol}
                </button>
              ))}
            </div>
          </div>
        </Panel>
        <NewsFeed symbol={symbol} />
      </div>
    </div>
  );
}
