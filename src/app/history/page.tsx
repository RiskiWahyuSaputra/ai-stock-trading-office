"use client";

import { History, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DemoBadge, EmptyState, PageHeader, Panel, SignalBadge } from "@/components/ui/primitives";
import { useOffice } from "@/lib/store/office-store";
import { formatPrice, formatTime } from "@/lib/utils";

export default function HistoryPage() {
  const reports = useOffice((s) => s.reports);
  const deleteReport = useOffice((s) => s.deleteReport);
  const [q, setQ] = useState("");
  const shown = reports.filter((r) => !q || r.request.symbol.includes(q.toUpperCase()));

  return (
    <div className="page-enter space-y-4 p-3 sm:p-4">
      <PageHeader title="Analysis History" description={`${reports.length} laporan tersimpan di perangkat ini (maks 50 terbaru).`} />
      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter simbol"
          aria-label="Filter simbol"
          className="h-9 w-full rounded-lg border border-line-strong bg-bg pl-9 pr-3 text-sm focus:border-accent focus:outline-none"
        />
      </div>
      <Panel className="overflow-hidden">
        {shown.length === 0 ? (
          <EmptyState icon={<History className="size-8" />} title="Belum ada riwayat analisis" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-subtle">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-medium">Waktu</th>
                  <th className="px-4 py-2 font-medium">Saham</th>
                  <th className="px-4 py-2 font-medium">TF · Mode</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Harga</th>
                  <th className="px-4 py-2 text-right font-medium">R/R TP2</th>
                  <th className="px-4 py-2 font-medium">Review</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((r) => (
                  <tr key={r.id} className="hover:bg-panel-2/50">
                    <td className="tabular px-4 py-2.5 text-xs text-muted">{formatTime(r.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/signals/${r.id}`} className="font-semibold hover:text-accent">
                        {r.request.symbol}
                      </Link>{" "}
                      {r.isDemo && <DemoBadge />}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted">
                      {r.request.timeframe} · {r.request.mode}
                    </td>
                    <td className="px-4 py-2.5">
                      <SignalBadge status={r.status} />
                    </td>
                    <td className="tabular px-4 py-2.5 text-right">{formatPrice(r.quote.lastPrice, r.request.market)}</td>
                    <td className="tabular px-4 py-2.5 text-right">{r.riskReward[1]?.toFixed(2) ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs capitalize text-muted">{r.review.verdict.replace("_", " ")}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => deleteReport(r.id)} className="rounded-md p-1.5 text-subtle hover:bg-panel-2 hover:text-bear" aria-label={`Hapus laporan ${r.request.symbol}`}>
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
