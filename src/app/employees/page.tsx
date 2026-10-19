"use client";

import { useState } from "react";
import { EmployeeDetailPanel } from "@/components/office/EmployeeDetailPanel";
import { PageHeader, Panel, ProgressBar, StatusPill } from "@/components/ui/primitives";
import { AGENT_ORDER, AGENTS, isWorking } from "@/lib/domain/agents";
import type { AgentId } from "@/lib/domain/schemas";
import { useOffice } from "@/lib/store/office-store";
import { cn } from "@/lib/utils";

export default function EmployeesPage() {
  const agents = useOffice((s) => s.agents);
  const activity = useOffice((s) => s.activity);
  const [selected, setSelected] = useState<AgentId>("news");

  return (
    <div className="page-enter space-y-4 p-3 sm:p-4">
      <PageHeader title="AI Employees" description="Tim analis AI, alur kerjanya berurutan dari riset berita hingga laporan final." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-3 md:grid-cols-2">
          {AGENT_ORDER.map((id, i) => {
            const p = AGENTS[id];
            const a = agents[id];
            const tasks = activity.filter((e) => e.agent === id && e.status === "completed").length;
            return (
              <button
                key={id}
                onClick={() => setSelected(id)}
                className={cn("rounded-xl border bg-panel p-4 text-left transition-colors hover:border-line-strong", selected === id ? "border-accent" : "border-line")}
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-12 shrink-0 place-items-center rounded-full text-lg font-semibold text-bg" style={{ background: p.color }}>
                    {p.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-subtle">Tahap {i + 1}</div>
                    <div className="truncate font-semibold">{p.name}</div>
                    <div className="truncate text-xs text-muted">{p.title}</div>
                  </div>
                  <StatusPill status={a.status} />
                </div>
                <p className="mt-3 text-xs text-muted">{p.role}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {p.outputs.map((o) => (
                    <span key={o} className="rounded-md bg-panel-2 px-1.5 py-0.5 text-[10px] text-muted">
                      {o}
                    </span>
                  ))}
                </div>
                <ProgressBar value={a.progress} className="mt-3" tone={isWorking(a.status) ? "bg-accent" : a.status === "completed" ? "bg-bull" : "bg-line-strong"} />
                <div className="mt-1.5 text-[11px] text-subtle">{tasks} tugas selesai tercatat</div>
              </button>
            );
          })}
          <Panel className="p-4 text-xs text-muted md:col-span-2">
            Status setiap karyawan mengikuti event workflow dari server. Persetujuan Signal Reviewer berarti laporan lolos pemeriksaan internal — bukan jaminan trading menguntungkan.
          </Panel>
        </div>
        <div className="xl:sticky xl:top-4 xl:h-[calc(100vh-7rem)]">
          <EmployeeDetailPanel id={selected} />
        </div>
      </div>
    </div>
  );
}
