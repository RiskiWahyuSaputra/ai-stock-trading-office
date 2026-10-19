"use client";

import { ListChecks } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FinalSignalCard } from "@/components/report/FinalSignalCard";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/Segmented";
import type { SignalStatus } from "@/lib/domain/schemas";
import { useOffice } from "@/lib/store/office-store";

type Filter = "all" | SignalStatus;

/** Latest final report per symbol & timeframe. */
export default function FinalSignalsPage() {
  const reports = useOffice((s) => s.reports);
  const [filter, setFilter] = useState<Filter>("all");

  const latest = reports.filter(
    (r, i) => reports.findIndex((x) => x.request.symbol === r.request.symbol && x.request.timeframe === r.request.timeframe) === i,
  );
  const shown = latest.filter((r) => filter === "all" || r.status === filter);

  return (
    <div className="page-enter space-y-4 p-3 sm:p-4">
      <PageHeader
        title="Final Signals"
        description="Laporan terbaru dari Final Signal Officer untuk tiap saham & timeframe."
        actions={
          <Link href="/analyze" className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-bg hover:bg-accent-strong">
            Analisis baru
          </Link>
        }
      />
      <div className="max-w-xl">
        <Segmented
          label="Filter status"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Semua" },
            { value: "BUY_SETUP", label: "Buy" },
            { value: "SELL_SETUP", label: "Sell" },
            { value: "WAIT", label: "Wait" },
            { value: "NO_TRADE", label: "No trade" },
          ]}
        />
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={<ListChecks className="size-8" />} title="Belum ada sinyal final">
          Jalankan analisis dari halaman Analyze Stock. Status WAIT dan NO TRADE juga dicatat — tidak setiap analisis menghasilkan setup.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((r) => (
            <FinalSignalCard key={r.id} report={r} />
          ))}
        </div>
      )}
    </div>
  );
}
