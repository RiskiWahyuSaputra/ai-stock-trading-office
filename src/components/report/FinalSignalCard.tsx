"use client";

import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOfficeCamera } from "@/components/office/camera-store";
import { DemoBadge, SignalBadge } from "@/components/ui/primitives";
import type { FinalReport } from "@/lib/domain/schemas";
import { cn, formatPrice, formatTime } from "@/lib/utils";

/**
 * Compact Final Signal Officer output. "Open" flies the office camera to the
 * officer's desk first, then transitions to the full report.
 */
export function useOpenReport() {
  const router = useRouter();
  const focusOn = useOfficeCamera((s) => s.focusOn);
  return (id: string, fromOffice = false) => {
    if (!fromOffice) return router.push(`/signals/${id}`);
    focusOn("officer");
    setTimeout(() => router.push(`/signals/${id}`), 700);
  };
}

export function FinalSignalCard({ report, fromOffice = false, className }: { report: FinalReport; fromOffice?: boolean; className?: string }) {
  const open = useOpenReport();
  const m = report.request.market;
  const actionable = report.status === "BUY_SETUP" || report.status === "SELL_SETUP";

  return (
    <div className={cn("rounded-xl border border-line bg-panel p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">{report.request.symbol}</span>
            <SignalBadge status={report.status} />
            {report.isDemo && <DemoBadge />}
          </div>
          <div className="truncate text-xs text-muted">{report.quote.stock.name}</div>
        </div>
        <div className="text-right">
          <div className="tabular text-sm font-semibold">{formatPrice(report.quote.lastPrice, m)}</div>
          <div className="text-[10px] text-subtle" title="Waktu data harga">{formatTime(report.quote.timestamp)}</div>
        </div>
      </div>

      {actionable ? (
        <dl className="tabular mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg bg-panel-2 p-2">
            <dt className="text-subtle">Entry</dt>
            <dd className="mt-0.5 font-medium">
              {formatPrice(report.entryZone?.low, m)}–{formatPrice(report.entryZone?.high, m)}
            </dd>
          </div>
          <div className="rounded-lg bg-panel-2 p-2">
            <dt className="text-subtle">Stop loss</dt>
            <dd className="mt-0.5 font-medium text-bear">{formatPrice(report.stopLoss, m)}</dd>
          </div>
          <div className="rounded-lg bg-panel-2 p-2">
            <dt className="text-subtle">TP1 · R/R</dt>
            <dd className="mt-0.5 font-medium text-bull">
              {formatPrice(report.takeProfits[0], m)} · {report.riskReward[0]?.toFixed(2)}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 rounded-lg bg-panel-2 p-2 text-xs text-muted">
          Tidak ada level entry yang diterbitkan. {report.mainRisks[0]}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-subtle">
        <span>
          {report.request.timeframe} · konfluensi {report.confidence.score}/100 · {formatTime(report.createdAt)}
        </span>
        <button onClick={() => open(report.id, fromOffice)} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
          Laporan lengkap <ArrowUpRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
