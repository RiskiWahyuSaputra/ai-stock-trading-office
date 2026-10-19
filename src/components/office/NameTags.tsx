"use client";

import {
  AGENT_ORDER,
  AGENTS,
  isWorking,
  STATUS_LABEL,
} from "@/lib/domain/agents";
import type { AgentId } from "@/lib/domain/schemas";
import { useOffice } from "@/lib/store/office-store";
import { tagElements } from "./tag-anchors";

const STATUS_COLOR = (status: string, working: boolean, accent: string) =>
  status === "failed"
    ? "#ef4444"
    : status === "needs_attention"
      ? "#f59e0b"
      : status === "completed"
        ? "#22c55e"
        : working
          ? accent
          : "#8b98b3";

function NameTag({
  id,
  onOpen,
}: {
  id: AgentId;
  onOpen: (id: AgentId) => void;
}) {
  const p = AGENTS[id];
  const agent = useOffice((s) => s.agents[id]);
  const selected = useOffice((s) => s.selectedAgent === id);
  const working = isWorking(agent.status);

  return (
    <div
      ref={(el) => {
        if (el) tagElements.set(id, el);
        else tagElements.delete(id);
      }}
      className="absolute left-0 top-0 size-0 will-change-transform"
      style={{ visibility: "hidden", transformOrigin: "0 0" }}
    >
      <button
        onClick={() => onOpen(id)}
        className="pointer-events-auto absolute bottom-0 left-0 block w-40 -translate-x-1/2 select-none rounded-lg border bg-bg-elevated/90 px-2.5 py-1.5 text-left shadow-lg shadow-black/40 backdrop-blur transition-colors"
        style={{ borderColor: selected ? p.color : "var(--border)" }}
        aria-label={`${p.name}, ${p.title}: ${STATUS_LABEL[agent.status]}`}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: p.color }}
          />
          <span className="truncate text-xs font-semibold text-fg">
            {p.name}
          </span>
          {agent.symbol && agent.status !== "idle" && (
            <span className="ml-auto text-[10px] font-semibold text-muted">
              {agent.symbol}
            </span>
          )}
        </div>
        <div className="truncate text-[10px] text-muted">{p.title}</div>
        <div className="mt-1 flex items-center gap-1.5">
          {working && (
            <span
              className="size-1.5 animate-pulse rounded-full"
              style={{ background: p.color }}
            />
          )}
          <span
            className="text-[10px] font-medium"
            style={{ color: STATUS_COLOR(agent.status, working, p.color) }}
          >
            {agent.status === "completed" ? "✓ " : ""}
            {STATUS_LABEL[agent.status]}
          </span>
        </div>
        {(working || agent.status === "queued") && (
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-panel-2">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${agent.progress}%`, background: p.color }}
            />
          </div>
        )}
      </button>
    </div>
  );
}

export function NameTags({ onOpen }: { onOpen: (id: AgentId) => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {AGENT_ORDER.map((id) => (
        <NameTag key={id} id={id} onOpen={onOpen} />
      ))}
    </div>
  );
}
