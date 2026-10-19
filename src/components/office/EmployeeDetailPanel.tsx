"use client";

import { X } from "lucide-react";
import { AGENTS, isWorking } from "@/lib/domain/agents";
import type { AgentId, FinalReport } from "@/lib/domain/schemas";
import { useOffice } from "@/lib/store/office-store";
import { formatPrice, formatTime } from "@/lib/utils";
import { Panel, ProgressBar, StatusPill } from "@/components/ui/primitives";
import { useOfficeCamera } from "./camera-store";
import { OfficeActivityFeed } from "./OfficeActivityFeed";

/** What this employee contributed to the latest report, if any. */
function LatestOutput({ id, report }: { id: AgentId; report: FinalReport }) {
  const m = report.request.market;
  const rows: [string, string][] = [];
  switch (id) {
    case "news":
      rows.push(["Sentimen", `${report.news.sentiment} (${report.news.sentimentScore.toFixed(2)})`], ["Berita", `${report.news.items.length} item`]);
      if (report.news.catalysts[0]) rows.push(["Katalis", report.news.catalysts[0]]);
      if (report.news.risks[0]) rows.push(["Risiko", report.news.risks[0]]);
      break;
    case "technical":
      rows.push(
        ["Tren", `${report.technical.direction} (${report.technical.trendScore.toFixed(2)})`],
        ["RSI14", report.technical.indicators.rsi14?.toFixed(1) ?? "—"],
        ["Entry", report.technical.entryZone ? `${formatPrice(report.technical.entryZone.low, m)}–${formatPrice(report.technical.entryZone.high, m)}` : "—"],
        ["SL", formatPrice(report.technical.stopLoss, m)],
      );
      break;
    case "risk":
      rows.push(
        ["Status", report.risk.status],
        ["R/R", report.risk.riskReward.length ? report.risk.riskReward.map((r) => r.toFixed(2)).join(" / ") : "—"],
        ["Volatilitas", report.risk.volatilityPct !== null ? `${report.risk.volatilityPct}%/bar` : "—"],
      );
      if (report.risk.issues[0]) rows.push(["Catatan", report.risk.issues[0]]);
      break;
    case "reviewer":
      rows.push(["Verdict", report.review.verdict.replace("_", " ")], ["Lolos", `${report.review.checks.filter((c) => c.passed).length}/${report.review.checks.length} pemeriksaan`]);
      if (report.review.conflicts[0]) rows.push(["Konflik", report.review.conflicts[0]]);
      break;
    case "officer":
      rows.push(["Status", report.status.replace("_", " ")], ["Konfluensi", `${report.confidence.score}/100`]);
      break;
  }
  return (
    <dl className="space-y-1.5 text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-3">
          <dt className="w-20 shrink-0 text-subtle">{k}</dt>
          <dd className="min-w-0 flex-1 text-fg">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmployeeDetailPanel({ id, onClose }: { id: AgentId; onClose?: () => void }) {
  const p = AGENTS[id];
  const agent = useOffice((s) => s.agents[id]);
  const latest = useOffice((s) => s.reports[0]);
  const focusOn = useOfficeCamera((s) => s.focusOn);

  return (
    <Panel className="flex flex-col overflow-hidden">
      <div className="flex items-start gap-3 border-b border-line p-4" style={{ boxShadow: `inset 3px 0 0 ${p.color}` }}>
        <div className="grid size-11 shrink-0 place-items-center rounded-full text-base font-semibold text-bg" style={{ background: p.color }}>
          {p.name[0]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{p.name}</div>
          <div className="text-xs text-muted">{p.title}</div>
          <div className="mt-1.5 flex items-center gap-2">
            <StatusPill status={agent.status} />
            {agent.symbol && agent.status !== "idle" && <span className="text-xs font-semibold text-muted">{agent.symbol}</span>}
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-panel-2 hover:text-fg" aria-label="Tutup detail">
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <section>
          <div className="mb-1.5 flex justify-between text-[11px] text-subtle">
            <span>Pekerjaan saat ini</span>
            <span className="tabular">{agent.progress}%</span>
          </div>
          <ProgressBar value={agent.progress} tone={isWorking(agent.status) ? "bg-accent" : agent.status === "completed" ? "bg-bull" : "bg-line-strong"} />
          <p className="mt-2 text-xs text-muted">{agent.message}</p>
          {agent.updatedAt && <p className="mt-1 text-[10px] text-subtle">Update: {formatTime(agent.updatedAt)}</p>}
        </section>

        <section>
          <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-subtle">Tanggung jawab</h3>
          <ul className="space-y-1 text-xs text-muted">
            {p.responsibilities.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full" style={{ background: p.color }} />
                {r}
              </li>
            ))}
          </ul>
        </section>

        {latest && (
          <section>
            <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-subtle">
              Output terakhir · {latest.request.symbol}
            </h3>
            <LatestOutput id={id} report={latest} />
          </section>
        )}

        <section>
          <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-subtle">Log aktivitas</h3>
          <OfficeActivityFeed agent={id} limit={15} />
        </section>
      </div>
      <div className="border-t border-line p-3">
        <button onClick={() => focusOn(id)} className="w-full rounded-lg bg-panel-2 py-2 text-xs text-muted hover:text-fg">
          Arahkan kamera ke meja {p.name}
        </button>
      </div>
    </Panel>
  );
}
