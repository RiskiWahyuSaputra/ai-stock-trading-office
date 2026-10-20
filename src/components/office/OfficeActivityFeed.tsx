"use client";

import { Activity } from "lucide-react";
import { AGENTS } from "@/lib/domain/agents";
import type { AgentId } from "@/lib/domain/schemas";
import { useOffice, type ActivityEntry } from "@/lib/store/office-store";
import { cn, formatTime } from "@/lib/utils";
import { EmptyState } from "@/components/ui/primitives";

const TONE: Partial<Record<ActivityEntry["status"], string>> = {
  completed: "text-bull",
  run_completed: "text-bull",
  failed: "text-bear",
  run_failed: "text-bear",
  needs_attention: "text-warn",
  handoff: "text-accent",
};

/**
 * Timeline of real workflow events (server timestamps). Nothing here is
 * generated for decoration — an empty office shows an empty timeline.
 */
export function OfficeActivityFeed({ agent, limit = 30, className }: { agent?: AgentId; limit?: number; className?: string }) {
  const activity = useOffice((s) => s.activity);
  const items = (agent ? activity.filter((a) => a.agent === agent) : activity).slice(0, limit);

  if (items.length === 0) {
    return (
      <EmptyState icon={<Activity className="size-6" />} title="Belum ada aktivitas">
        Aktivitas muncul saat tim AI benar-benar mengerjakan analisis.
      </EmptyState>
    );
  }

  return (
    <ol className={cn("relative space-y-3 pl-4", className)}>
      <span className="absolute bottom-1 left-[5px] top-1 w-px bg-line" aria-hidden />
      {items.map((e) => {
        const p = e.agent ? AGENTS[e.agent] : null;
        return (
          <li key={e.id} className="relative">
            <span
              className="absolute -left-4 top-1.5 size-2.5 rounded-full border-2 border-panel"
              style={{ background: p?.color ?? "var(--accent)" }}
              aria-hidden
            />
            <div className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
              <span className="font-medium text-fg">{p ? p.name : "Office"}</span>
              <span className="text-subtle">{p?.title.replace(" AI", "")}</span>
              <span className="font-semibold text-muted">{e.symbol}</span>
              <time className="tabular ml-auto text-[10px] text-subtle" dateTime={new Date(e.at).toISOString()}>
                {formatTime(e.at, undefined, false)}
              </time>
            </div>
            <p className={cn("mt-0.5 text-xs text-muted", TONE[e.status])}>{e.message}</p>
          </li>
        );
      })}
    </ol>
  );
}
