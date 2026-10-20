"use client";

import { AlertCircle, Play, Square } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { StockChart } from "@/components/charts/StockChart";
import { OfficeView } from "@/components/office/OfficeView";
import { AgentResults } from "@/components/report/AgentResults";
import { FinalSignalCard } from "@/components/report/FinalSignalCard";
import { Button, DemoBadge, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/Segmented";
import { useCandles } from "@/hooks/useCandles";
import { MIN_RR } from "@/lib/agents/risk-manager";
import type { AnalysisMode, Market, Timeframe } from "@/lib/domain/schemas";
import { useAutopilotHold } from "@/lib/store/autopilot";
import { useOffice } from "@/lib/store/office-store";
import { prayerTitle } from "@/lib/prayer-times";
import { cn, formatTime } from "@/lib/utils";
import { AgentWorkflow } from "./AgentWorkflow";
import { StockSearch } from "./StockSearch";

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "1h", label: "1H" },
  { value: "4h", label: "4H" },
  { value: "1D", label: "1D" },
  { value: "1W", label: "1W" },
];

const MODES: { value: AnalysisMode; label: string; hint: string }[] = [
  { value: "conservative", label: "Konservatif", hint: `Min R/R ${MIN_RR.conservative}, stop 1.5×ATR` },
  { value: "balanced", label: "Seimbang", hint: `Min R/R ${MIN_RR.balanced}, stop 1.2×ATR` },
  { value: "aggressive", label: "Agresif", hint: `Min R/R ${MIN_RR.aggressive}, stop 1.0×ATR` },
];

export function AnalyzeStock() {
  const params = useSearchParams();
  const settings = useOffice((s) => s.settings);
  const watchlist = useOffice((s) => s.watchlist);
  const run = useOffice((s) => s.run);
  const reports = useOffice((s) => s.reports);
  const startAnalysis = useOffice((s) => s.startAnalysis);
  const requestAnalysis = useOffice((s) => s.requestAnalysis);
  const prayerBreak = useOffice((s) => s.prayerBreak);
  const queuedTask = useOffice((s) => s.queuedTask);
  const clearQueuedTask = useOffice((s) => s.clearQueuedTask);
  const cancelAnalysis = useOffice((s) => s.cancelAnalysis);

  const initialMarket = (params.get("market") as Market | null) ?? settings.market;
  const [market, setMarket] = useState<Market>(initialMarket === "US" ? "US" : "IDX");
  const [symbol, setSymbol] = useState(params.get("symbol")?.toUpperCase() ?? "");
  const [timeframe, setTimeframe] = useState<Timeframe>(settings.timeframe);
  const [mode, setMode] = useState<AnalysisMode>(settings.mode);
  const [formError, setFormError] = useState<string | null>(null);

  const running = run?.phase === "running";
  // Autopilot work never blocks the CEO: starting a task here pre-empts it.
  const busy = running && run?.request.origin !== "autopilot";
  // While the CEO's own run is on screen, the autopilot must not replace it.
  useAutopilotHold(!!run && run.request.origin !== "autopilot");
  const report = run?.reportId ? reports.find((r) => r.id === run.reportId) : undefined;
  // The chart follows the CEO's own run; autopilot runs leave it on the typed symbol.
  const ownRun = busy || (!!report && run?.request.origin !== "autopilot");
  const chartSymbol = ownRun ? (run?.request.symbol ?? null) : symbol.length >= 2 ? symbol : null;
  const chartTf = ownRun ? (run?.request.timeframe ?? timeframe) : timeframe;
  const chartMarket = ownRun ? (run?.request.market ?? market) : market;
  const chart = useCandles(chartSymbol, chartMarket, chartTf, 120);

  const start = () => {
    const s = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9.]{1,12}$/.test(s)) {
      setFormError("Masukkan simbol saham yang valid.");
      return;
    }
    setFormError(null);
    requestAnalysis({ symbol: s, market, timeframe, mode });
  };

  return (
    <div className="page-enter space-y-4 p-3 sm:p-4">
      <PageHeader
        title="Analyze Stock"
        description="Beri tugas ke tim AI. Setiap tahap dijalankan di server dan terlihat di kantor."
      />

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel className="space-y-4 p-4">
            <Segmented
              label="Pasar"
              value={market}
              disabled={busy}
              options={[
                { value: "IDX", label: "IDX (Indonesia)" },
                { value: "US", label: "US" },
              ]}
              onChange={(m) => {
                setMarket(m);
                setSymbol("");
              }}
            />
            <StockSearch value={symbol} market={market} onChange={setSymbol} onSelect={(s) => setSymbol(s.symbol)} />
            {watchlist.some((w) => w.market === market) && (
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted">Dari watchlist</div>
                <div className="flex flex-wrap gap-1.5">
                  {watchlist
                    .filter((w) => w.market === market)
                    .map((w) => (
                      <button
                        key={w.symbol}
                        disabled={busy}
                        onClick={() => setSymbol(w.symbol)}
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                          symbol === w.symbol ? "border-accent text-accent" : "border-line-strong text-muted hover:text-fg",
                        )}
                      >
                        {w.symbol}
                      </button>
                    ))}
                </div>
              </div>
            )}
            <Segmented label="Timeframe" value={timeframe} options={TIMEFRAMES} onChange={setTimeframe} disabled={busy} />
            <Segmented label="Mode analisis (profil risiko)" value={mode} options={MODES} onChange={setMode} disabled={busy} />
            {prayerBreak && (
              <div className="rounded-lg border border-accent/30 bg-accent/5 p-2.5 text-[11px] text-muted">
                <p>
                  Tim sedang istirahat jam {prayerTitle(prayerBreak)} sampai{" "}
                  <b className="text-fg">{formatTime(prayerBreak.end, undefined, false).slice(0, 5)}</b>. Tugas baru dijadwalkan setelah istirahat.
                </p>
                {queuedTask && (
                  <p className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-accent">Dijadwalkan: {queuedTask.symbol} · {queuedTask.timeframe}</span>
                    <button className="text-fg underline" onClick={() => { clearQueuedTask(); void startAnalysis(queuedTask); }}>
                      Mulai sekarang
                    </button>
                    <button className="text-subtle hover:text-fg" onClick={clearQueuedTask}>
                      Batalkan
                    </button>
                  </p>
                )}
              </div>
            )}
            {running && !busy && (
              <p className="text-[11px] text-accent">Autopilot sedang menganalisis {run?.request.symbol}. Start Analysis akan mendahulukan tugas Anda.</p>
            )}
            <p className="text-[11px] text-subtle">{MODES.find((m) => m.value === mode)?.hint}. Metode: teknikal berbasis aturan + sentimen berita leksikon (bukan LLM).</p>

            {formError && (
              <p className="flex items-center gap-1.5 text-xs text-bear">
                <AlertCircle className="size-3.5" /> {formError}
              </p>
            )}
            {busy ? (
              <Button variant="danger" className="w-full" onClick={cancelAnalysis}>
                <Square className="size-4" /> Batalkan analisis {run?.request.symbol}
              </Button>
            ) : (
              <Button variant="primary" className="w-full" onClick={start} disabled={!symbol}>
                <Play className="size-4" /> {prayerBreak ? "Jadwalkan setelah istirahat" : "Start Analysis"}
              </Button>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Progress timeline" subtitle={run ? `${run.request.symbol} · ${run.request.timeframe} · ${run.request.mode}` : "Belum ada analisis berjalan"} />
            <div className="p-2">
              <AgentWorkflow />
            </div>
          </Panel>
        </div>

        <div className="min-w-0 space-y-4">
          <OfficeView compact className="h-[300px] sm:h-[360px]" />

          {run?.phase === "failed" && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-bear/40 bg-bear/10 p-4 text-sm text-bear">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div>
                <div className="font-medium">Analisis {run.request.symbol} tidak selesai</div>
                <div className="mt-0.5 text-xs">{run.error}</div>
              </div>
            </div>
          )}

          {report && <FinalSignalCard report={report} />}

          <Panel>
            <PanelHeader
              title={chartSymbol ? `${chartSymbol} · ${chartTf}` : "Grafik harga"}
              subtitle={chart.data ? `${chart.data.candles.length} candle · ${chart.data.source.name}` : "Pilih simbol untuk melihat grafik"}
              action={chart.data?.source.isDemo ? <DemoBadge /> : undefined}
            />
            <div className="p-3">
              {chart.error ? (
                <p className="py-10 text-center text-xs text-bear">{chart.error}</p>
              ) : chart.data ? (
                <StockChart
                  candles={chart.data.candles}
                  market={report?.request.market ?? market}
                  timeframe={chartTf}
                  levels={report ? { entryZone: report.entryZone, stopLoss: report.stopLoss, takeProfits: report.takeProfits } : null}
                />
              ) : (
                <div className="grid h-[320px] place-items-center text-xs text-subtle">{chart.loading ? "Memuat data harga…" : "Belum ada simbol dipilih."}</div>
              )}
            </div>
          </Panel>

          {report && <AgentResults report={report} />}
        </div>
      </div>
    </div>
  );
}
