"use client";

import { HIGH_GAP_PCT, HIGH_VOL_PCT } from "@/lib/agents/risk-manager";
import type { FinalReport } from "@/lib/domain/schemas";
import { Badge, Panel, PanelHeader } from "@/components/ui/primitives";
import { cn, formatMoney, formatPrice } from "@/lib/utils";

const STATUS_TONE = {
  eligible: "border-bull/40 bg-bull/10 text-bull",
  caution: "border-warn/40 bg-warn/10 text-warn",
  rejected: "border-bear/40 bg-bear/10 text-bear",
} as const;

/** Risk Manager output: R/R bars against the minimum, volatility & gap meters. */
export function RiskAssessmentPanel({ report }: { report: FinalReport }) {
  const r = report.risk;
  const m = report.request.market;
  const tf = report.request.timeframe;
  const maxRR = Math.max(4, ...r.riskReward);

  const meter = (label: string, value: number | null, limit: number) => (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className={cn("tabular", value !== null && value > limit ? "text-warn" : "text-fg")}>{value === null ? "—" : `${value.toFixed(2)}%`}</span>
      </div>
      <div className="relative mt-1 h-1.5 rounded-full bg-panel-2">
        <div className={cn("h-full rounded-full", value !== null && value > limit ? "bg-warn" : "bg-accent")} style={{ width: `${Math.min(100, ((value ?? 0) / (limit * 2)) * 100)}%` }} />
        <span className="absolute -top-0.5 h-2.5 w-px bg-muted" style={{ left: "50%" }} title={`Batas ${limit}%`} />
      </div>
      <div className="mt-0.5 text-[10px] text-subtle">Batas {tf}: {limit}%</div>
    </div>
  );

  return (
    <Panel>
      <PanelHeader title="Risk assessment" subtitle={`Mode ${report.request.mode} · minimum R/R ${r.minRiskReward}`} action={<Badge className={STATUS_TONE[r.status]}>{r.status}</Badge>} />
      <div className="space-y-4 p-4">
        {r.riskReward.length > 0 ? (
          <div className="space-y-2">
            {r.riskReward.map((rr, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">TP{i + 1}</span>
                  <span className="tabular text-fg">{rr.toFixed(2)}R</span>
                </div>
                <div className="relative mt-1 h-2 rounded-full bg-panel-2">
                  <div className={cn("h-full rounded-full", rr >= r.minRiskReward ? "bg-bull" : "bg-warn")} style={{ width: `${(rr / maxRR) * 100}%` }} />
                  <span className="absolute -top-1 h-4 w-px bg-muted" style={{ left: `${(r.minRiskReward / maxRR) * 100}%` }} title={`Minimum ${r.minRiskReward}R`} />
                </div>
              </div>
            ))}
            {r.riskPerShare !== null && <p className="text-[11px] text-subtle">Risiko per saham {formatPrice(r.riskPerShare, m)} dari tengah area entry ke stop loss.</p>}
          </div>
        ) : (
          <p className="text-xs text-muted">Tidak ada skenario dengan level untuk dihitung.</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {meter("Volatilitas (ATR/harga)", r.volatilityPct, HIGH_VOL_PCT[tf])}
          {meter("Gap terbesar (60 bar)", r.maxGapPct, HIGH_GAP_PCT[tf])}
        </div>

        {r.position && (
          <div className="rounded-lg bg-panel-2 p-3 text-xs text-muted">
            Modal {formatMoney(r.position.accountSize, m)}, risiko {r.position.riskPct}% → maks rugi {formatMoney(r.position.maxLoss, m)} ·{" "}
            {r.position.lots !== null ? `${r.position.lots} lot (${r.position.shares} saham)` : `${r.position.shares} saham`} · nilai posisi {formatMoney(r.position.positionValue, m)}
          </div>
        )}

        {(r.issues.length > 0 || r.notes.length > 0) && (
          <ul className="space-y-1 text-xs">
            {r.issues.map((x, i) => (
              <li key={`i${i}`} className="text-warn">! {x}</li>
            ))}
            {r.notes.map((x, i) => (
              <li key={`n${i}`} className="text-muted">• {x}</li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
