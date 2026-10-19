"use client";

import { Newspaper } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, DemoBadge, EmptyState, Panel, PanelHeader } from "@/components/ui/primitives";
import { api } from "@/lib/api/client";
import type { NewsReport } from "@/lib/domain/schemas";
import { cn, formatTime } from "@/lib/utils";

const SENTIMENT_TONE = {
  positive: "border-bull/40 text-bull",
  negative: "border-bear/40 text-bear",
  neutral: "border-line-strong text-muted",
} as const;

/** News for one symbol, classified by the News Researcher's rule-based method. */
export function NewsFeed({ symbol }: { symbol: string }) {
  const [state, setState] = useState<{ symbol: string; report: NewsReport | null; error: string | null }>({ symbol: "", report: null, error: null });

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .news(symbol, ctrl.signal)
      .then((report) => setState({ symbol, report, error: null }))
      .catch((e: Error) => e.name !== "AbortError" && setState({ symbol, report: null, error: e.message }));
    return () => ctrl.abort();
  }, [symbol]);

  const report = state.symbol === symbol ? state.report : null;
  const error = state.symbol === symbol ? state.error : null;

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title={`Berita ${symbol}`}
        subtitle={report ? `${report.source.name} · ${report.method}` : "Memuat…"}
        action={report?.source.isDemo ? <DemoBadge /> : undefined}
      />
      {error ? (
        <p className="p-6 text-center text-xs text-bear">{error}</p>
      ) : !report ? (
        <p className="p-10 text-center text-xs text-subtle">Mengambil berita dari provider…</p>
      ) : report.items.length === 0 ? (
        <EmptyState icon={<Newspaper className="size-8" />} title="Tidak ada berita" />
      ) : (
        <>
          <div className="grid gap-4 border-b border-line p-4 sm:grid-cols-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-subtle">Sentimen tertimbang</div>
              <div className={cn("mt-1 text-lg font-semibold capitalize", report.sentiment === "positive" ? "text-bull" : report.sentiment === "negative" ? "text-bear" : "text-fg")}>
                {report.sentiment} <span className="tabular text-sm text-muted">({report.sentimentScore.toFixed(2)})</span>
              </div>
            </div>
            <div className="text-xs text-muted sm:col-span-2">{report.summary}</div>
          </div>
          <ul className="divide-y divide-line">
            {report.items.map((n) => (
              <li key={n.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={SENTIMENT_TONE[n.sentiment]}>{n.sentiment}</Badge>
                  <Badge className={n.impact === "high" ? "border-warn/40 text-warn" : "border-line-strong text-subtle"}>dampak {n.impact}</Badge>
                </div>
                <p className="mt-1.5 text-sm text-fg">{n.headline}</p>
                <p className="mt-0.5 text-xs text-muted">{n.summary}</p>
                <p className="mt-1 text-[11px] text-subtle">
                  {n.publisher} · dipublikasikan {formatTime(n.publishedAt)}
                  {n.eventAt ? ` · kejadian ${formatTime(n.eventAt)}` : ""}
                  {n.url && (
                    <>
                      {" · "}
                      <a href={n.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                        sumber
                      </a>
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
