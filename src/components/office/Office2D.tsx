"use client";

import { AGENT_ORDER, AGENTS, isWorking } from "@/lib/domain/agents";
import type { AgentId } from "@/lib/domain/schemas";
import { useOffice } from "@/lib/store/office-store";
import { ProgressBar, StatusPill } from "@/components/ui/primitives";
import { prayerTitle } from "@/lib/prayer-times";
import { cn, formatTime } from "@/lib/utils";

/**
 * 2D fallback floor plan for devices without WebGL (or when the user picks
 * 2D). Shows the same statuses, progress and selection as the 3D office.
 */
export function Office2D({
  onOpenAgent,
}: {
  onOpenAgent: (id: AgentId) => void;
}) {
  const agents = useOffice((s) => s.agents);
  const selected = useOffice((s) => s.selectedAgent);
  const active = useOffice((s) =>
    s.run?.phase === "running" ? s.activeAgent : null,
  );
  const handoff = useOffice((s) => s.handoff);
  const prayerBreak = useOffice((s) => s.prayerBreak);

  return (
    <div className="grid h-full content-center gap-3 overflow-y-auto bg-[radial-gradient(ellipse_at_top,#0f1a30,transparent_70%)] p-4 sm:grid-cols-2 xl:grid-cols-3">
      {prayerBreak && (
        <p className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn sm:col-span-2 xl:col-span-3">
          ☕ Tim sedang istirahat jam {prayerTitle(prayerBreak)} di pojok kopi sampai {formatTime(prayerBreak.end, undefined, false).slice(0, 5)}.
        </p>
      )}
      {handoff && (
        <p key={handoff.id} className="page-enter rounded-lg border border-line bg-panel-2 px-3 py-2 text-xs text-muted sm:col-span-2 xl:col-span-3">
          <span className="font-semibold" style={{ color: AGENTS[handoff.from].color }}>{AGENTS[handoff.from].name}</span>
          {" → "}
          <span className="font-semibold" style={{ color: AGENTS[handoff.to].color }}>{AGENTS[handoff.to].name}</span>
          <span className="text-subtle"> · {handoff.symbol}</span>: {handoff.message}
        </p>
      )}
      {AGENT_ORDER.map((id) => {
        const p = AGENTS[id];
        const a = agents[id];
        const working = isWorking(a.status);
        return (
          <button
            key={id}
            onClick={() => onOpenAgent(id)}
            className={cn(
              "group rounded-xl border bg-panel p-4 text-left transition-colors hover:border-line-strong",
              id === "officer" && "sm:col-span-2 xl:col-span-1",
              selected === id
                ? "border-accent"
                : active === id
                  ? "border-accent/50"
                  : "border-line",
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className="relative grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold text-bg"
                style={{ background: p.color }}
              >
                {p.name[0]}
                {working && (
                  <span className="absolute -right-0.5 -top-0.5 size-3 animate-pulse rounded-full border-2 border-panel bg-accent" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{p.name}</div>
                <div className="truncate text-xs text-muted">{p.title}</div>
              </div>
              <StatusPill status={a.status} />
            </div>
            <p className="mt-3 line-clamp-2 min-h-8 text-xs text-muted">
              {a.message}
            </p>
            <ProgressBar
              value={a.progress}
              className="mt-3"
              tone={
                working
                  ? "bg-accent"
                  : a.status === "completed"
                    ? "bg-bull"
                    : "bg-line-strong"
              }
            />
            <div className="mt-2 flex justify-between text-[11px] text-subtle">
              <span>{a.symbol ?? "—"}</span>
              <span>
                {a.updatedAt
                  ? new Date(a.updatedAt).toLocaleTimeString("id-ID")
                  : "Belum ada tugas"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
