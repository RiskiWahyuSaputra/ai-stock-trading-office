"use client";

import { Check, Loader2, TriangleAlert, X } from "lucide-react";
import { AGENT_ORDER, AGENTS, isWorking } from "@/lib/domain/agents";
import { useOffice } from "@/lib/store/office-store";
import { ProgressBar, StatusPill } from "@/components/ui/primitives";
import { cn, formatTime } from "@/lib/utils";
import { useOfficeCamera } from "@/components/office/camera-store";

/** Vertical stage timeline mirroring the office workflow. */
export function AgentWorkflow() {
  const agents = useOffice((s) => s.agents);
  const selectAgent = useOffice((s) => s.selectAgent);
  const focusOn = useOfficeCamera((s) => s.focusOn);

  return (
    <ol className="space-y-1">
      {AGENT_ORDER.map((id, i) => {
        const p = AGENTS[id];
        const a = agents[id];
        const working = isWorking(a.status);
        const Icon =
          a.status === "completed" ? Check : a.status === "failed" ? X : a.status === "needs_attention" ? TriangleAlert : working ? Loader2 : null;
        return (
          <li key={id}>
            <button
              onClick={() => {
                selectAgent(id);
                focusOn(id);
              }}
              className={cn("flex w-full gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-panel-2", working && "bg-panel-2")}
            >
              <div className="flex flex-col items-center">
                <span
                  className={cn("grid size-7 place-items-center rounded-full border text-xs font-semibold", a.status === "idle" || a.status === "queued" ? "border-line-strong text-subtle" : "text-bg")}
                  style={a.status === "idle" || a.status === "queued" ? undefined : { background: p.color, borderColor: p.color }}
                >
                  {Icon ? <Icon className={cn("size-3.5", working && "animate-spin")} /> : i + 1}
                </span>
                {i < AGENT_ORDER.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{p.title}</span>
                  <StatusPill status={a.status} className="ml-auto" />
                </div>
                <p className="mt-1 text-xs text-muted">{a.message}</p>
                {(working || a.status === "queued") && <ProgressBar value={a.progress} className="mt-2" />}
                {a.updatedAt && <p className="mt-1 text-[10px] text-subtle">{formatTime(a.updatedAt, undefined, false)}</p>}
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
