"use client";

import { AGENT_ORDER, isWorking } from "@/lib/domain/agents";
import { useOffice } from "@/lib/store/office-store";
import { DemoBadge, Stat } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/** Office KPIs derived from the store — no fabricated counters. */
export function OfficeOverviewPanel({ className }: { className?: string }) {
  const agents = useOffice((s) => s.agents);
  const run = useOffice((s) => s.run);
  const reports = useOffice((s) => s.reports);
  const provider = useOffice((s) => s.provider);

  const working = AGENT_ORDER.filter((id) => isWorking(agents[id].status)).length;
  const waitingReview = reports.filter((r) => r.review.verdict === "needs_review" || r.review.verdict === "conflicting").length;
  const latest = reports[0];

  return (
    <div className={cn("grid grid-cols-2 gap-4 rounded-xl border border-line bg-panel p-4 sm:grid-cols-3 xl:grid-cols-6", className)}>
      <Stat label="Agen aktif" value={`${working}/${AGENT_ORDER.length}`} hint={working ? "sedang bekerja" : "semua standby"} />
      <Stat label="Pekerjaan berjalan" value={run?.phase === "running" ? 1 : 0} hint={run?.phase === "running" ? `${run.request.symbol} · ${run.request.timeframe}` : "tidak ada"} />
      <Stat label="Analisis selesai" value={reports.length} hint="tersimpan di perangkat ini" />
      <Stat label="Menunggu review" value={waitingReview} hint="WAIT karena konflik/review" />
      <Stat
        label="Laporan terbaru"
        value={latest ? `${latest.request.symbol} · ${latest.status.replace("_", " ")}` : "—"}
        hint={latest ? new Date(latest.createdAt).toLocaleString("id-ID") : "belum ada"}
      />
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-subtle">Sumber data</div>
        <div className="mt-1 flex items-center gap-2">
          <span className={cn("size-2 rounded-full", provider.ok ? "bg-bull" : "bg-bear")} />
          <span className="truncate text-sm font-semibold">{provider.ok ? "Terhubung" : provider.checkedAt ? "Terputus" : "Memeriksa"}</span>
          {provider.status?.market.isDemo && <DemoBadge />}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted">{provider.status?.market.name ?? "—"}</div>
      </div>
    </div>
  );
}
