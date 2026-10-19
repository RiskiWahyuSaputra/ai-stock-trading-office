"use client";

import { Play, RefreshCw, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StockSearch } from "@/components/analysis/StockSearch";
import { DemoBadge, EmptyState, Panel, PanelHeader, SignalBadge } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/Segmented";
import { api } from "@/lib/api/client";
import type { Market, Quote } from "@/lib/domain/schemas";
import { useOffice } from "@/lib/store/office-store";
import { cn, formatPrice, formatTime } from "@/lib/utils";

/**
 * Watchlist with on-demand quotes. Prices are fetched when the page opens or
 * on refresh — they do not stream, so nothing pretends to be real-time.
 */
export function WatchlistPanel() {
  const watchlist = useOffice((s) => s.watchlist);
  const reports = useOffice((s) => s.reports);
  const toggleWatch = useOffice((s) => s.toggleWatch);
  const [market, setMarket] = useState<Market>("IDX");
  const [query, setQuery] = useState("");
  const [quotes, setQuotes] = useState<Record<string, Quote | { error: string }>>({});
  const [loading, setLoading] = useState(false);

  const symbols = watchlist.map((w) => w.symbol).join(",");
  const refresh = useCallback(async () => {
    if (!symbols) return;
    setLoading(true);
    const entries = await Promise.all(
      symbols.split(",").map(async (s) => {
        try {
          return [s, await api.quote(s)] as const;
        } catch (e) {
          return [s, { error: (e as Error).message }] as const;
        }
      }),
    );
    setQuotes(Object.fromEntries(entries));
    setLoading(false);
  }, [symbols]);

  useEffect(() => {
    // Fetching on mount/change is the external sync this effect exists for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel className="overflow-hidden">
        <PanelHeader
          title={`Watchlist (${watchlist.length})`}
          subtitle="Harga diambil saat halaman dibuka atau saat refresh."
          action={
            <button onClick={refresh} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg" disabled={loading}>
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Refresh
            </button>
          }
        />
        {watchlist.length === 0 ? (
          <EmptyState icon={<Star className="size-8" />} title="Watchlist kosong">
            Tambahkan saham dari panel kanan atau dari laporan final.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-subtle">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-medium">Saham</th>
                  <th className="px-4 py-2 text-right font-medium">Harga</th>
                  <th className="px-4 py-2 text-right font-medium">Perubahan</th>
                  <th className="px-4 py-2 font-medium">Sinyal terakhir</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {watchlist.map((w) => {
                  const q = quotes[w.symbol];
                  const last = reports.find((r) => r.request.symbol === w.symbol);
                  return (
                    <tr key={w.symbol} className="hover:bg-panel-2/50">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{w.symbol}</div>
                        <div className="max-w-[220px] truncate text-xs text-muted">{q && "stock" in q ? q.stock.name : w.market}</div>
                      </td>
                      <td className="tabular px-4 py-3 text-right">
                        {q && "lastPrice" in q ? (
                          <>
                            <div className="flex items-center justify-end gap-1.5">
                              {q.source.isDemo && <DemoBadge />}
                              {formatPrice(q.lastPrice, w.market)}
                            </div>
                            <div className="text-[10px] text-subtle">{formatTime(q.timestamp)}</div>
                          </>
                        ) : q && "error" in q ? (
                          <span className="text-xs text-bear">{q.error}</span>
                        ) : (
                          <span className="text-xs text-subtle">…</span>
                        )}
                      </td>
                      <td className={cn("tabular px-4 py-3 text-right", q && "change" in q ? (q.change >= 0 ? "text-bull" : "text-bear") : "")}>
                        {q && "changePct" in q ? `${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {last ? (
                          <Link href={`/signals/${last.id}`} className="inline-flex items-center gap-2 hover:underline">
                            <SignalBadge status={last.status} />
                            <span className="text-[11px] text-subtle">
                              {last.request.timeframe} · {formatTime(last.createdAt)}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-xs text-subtle">Belum dianalisis</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Link
                            href={`/analyze?symbol=${w.symbol}&market=${w.market}`}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-accent hover:bg-panel-2"
                          >
                            <Play className="size-3" /> Analisis
                          </Link>
                          <button onClick={() => toggleWatch(w.symbol, w.market)} className="rounded-md p-1.5 text-subtle hover:bg-panel-2 hover:text-bear" aria-label={`Hapus ${w.symbol}`}>
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel className="h-fit space-y-4 p-4">
        <h2 className="text-sm font-semibold">Tambah saham</h2>
        <Segmented
          label="Pasar"
          value={market}
          onChange={(m) => {
            setMarket(m);
            setQuery("");
          }}
          options={[
            { value: "IDX", label: "IDX" },
            { value: "US", label: "US" },
          ]}
        />
        <StockSearch
          value={query}
          market={market}
          onChange={setQuery}
          onSelect={(s) => {
            if (!watchlist.some((w) => w.symbol === s.symbol)) toggleWatch(s.symbol, s.market);
            setQuery("");
          }}
        />
      </Panel>
    </div>
  );
}
