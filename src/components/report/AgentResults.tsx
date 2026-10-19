"use client";

import { AGENTS } from "@/lib/domain/agents";
import type { AgentId, FinalReport } from "@/lib/domain/schemas";
import { formatPrice, formatTime } from "@/lib/utils";
import { Panel, PanelHeader } from "@/components/ui/primitives";

/** Per-agent result summary (Team Review) for a finished analysis. */
export function AgentResults({ report }: { report: FinalReport }) {
  const m = report.request.market;
  const t = report.technical;
  const entries: { id: AgentId; verdict: string; at: number; lines: string[] }[] = [
    {
      id: "news",
      verdict: `Sentimen ${report.news.sentiment}`,
      at: report.news.completedAt,
      lines: [report.news.summary, ...(report.news.catalysts[0] ? [`Katalis: ${report.news.catalysts[0]}`] : [])],
    },
    {
      id: "technical",
      verdict: `Tren ${t.direction}`,
      at: t.completedAt,
      lines: [
        `Skor tren ${t.trendScore.toFixed(2)} dari ${t.candlesUsed} candle ${t.timeframe}.`,
        t.entryZone
          ? `Entry ${formatPrice(t.entryZone.low, m)}–${formatPrice(t.entryZone.high, m)}, SL ${formatPrice(t.stopLoss, m)}, TP ${t.takeProfits.map((x) => formatPrice(x, m)).join(" / ")}.`
          : "Tidak ada level entry (arah tidak jelas atau data kurang).",
      ],
    },
    {
      id: "risk",
      verdict: `Status ${report.risk.status}`,
      at: report.risk.completedAt,
      lines: [
        report.risk.riskReward.length ? `R/R ${report.risk.riskReward.map((r) => r.toFixed(2)).join(" / ")} (min ${report.risk.minRiskReward}).` : "R/R tidak dihitung.",
        ...report.risk.issues.slice(0, 2),
      ],
    },
    {
      id: "reviewer",
      verdict: report.review.verdict.replace("_", " "),
      at: report.review.completedAt,
      lines: [
        `${report.review.checks.filter((c) => c.passed).length}/${report.review.checks.length} pemeriksaan lolos.`,
        ...report.review.conflicts,
        ...(report.review.returnedTo.length ? [`Sempat dikembalikan ke: ${report.review.returnedTo.map((a) => AGENTS[a].title).join(", ")}.`] : []),
      ],
    },
    {
      id: "officer",
      verdict: report.status.replace("_", " "),
      at: report.createdAt,
      lines: [`Konfluensi ${report.confidence.score}/100 (${report.confidence.label}).`],
    },
  ];

  return (
    <Panel>
      <PanelHeader title="Team Review" subtitle="Hasil pemeriksaan tiap agen" />
      <ul className="divide-y divide-line">
        {entries.map((e) => {
          const p = AGENTS[e.id];
          return (
            <li key={e.id} className="flex gap-3 px-4 py-3">
              <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium">{p.title}</span>
                  <span className="text-xs font-semibold capitalize text-fg">{e.verdict}</span>
                  <time className="ml-auto text-[10px] text-subtle">{formatTime(e.at)}</time>
                </div>
                {e.lines.map((l, i) => (
                  <p key={i} className="mt-0.5 text-xs text-muted">
                    {l}
                  </p>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
