"use client";

import {
  BellPlus,
  ChevronDown,
  ClipboardCopy,
  Download,
  RefreshCw,
  ShieldAlert,
  Star,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { StockChart } from "@/components/charts/StockChart";
import { Badge, Button, DemoBadge, Panel, PanelHeader, SignalBadge } from "@/components/ui/primitives";
import { useCandles } from "@/hooks/useCandles";
import { api } from "@/lib/api/client";
import type { FinalReport } from "@/lib/domain/schemas";
import { downloadFile, reportToMarkdown } from "@/lib/report/format";
import { useOffice } from "@/lib/store/office-store";
import { cn, formatMoney, formatPrice, formatTime } from "@/lib/utils";
import { AgentResults } from "./AgentResults";
import { RiskAssessmentPanel } from "./RiskAssessmentPanel";

/** Marks whether a block is raw data, deterministic math, or interpretation. */
function Kind({ kind }: { kind: "data" | "calc" | "ai" }) {
  const map = {
    data: ["Fakta data", "border-info/40 text-info"],
    calc: ["Hasil perhitungan", "border-accent/40 text-accent"],
    ai: ["Interpretasi agen", "border-[#a78bfa]/40 text-[#a78bfa]"],
  } as const;
  return <Badge className={cn("bg-transparent", map[kind][1])}>{map[kind][0]}</Badge>;
}

function Section({ title, kind, children, className }: { title: string; kind: "data" | "calc" | "ai"; children: ReactNode; className?: string }) {
  return (
    <Panel className={className}>
      <PanelHeader title={title} action={<Kind kind={kind} />} />
      <div className="p-4">{children}</div>
    </Panel>
  );
}

function Row({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className={cn("tabular text-right font-medium", tone)}>{value}</dd>
    </div>
  );
}

export function FinalSignalReport({ report }: { report: FinalReport }) {
  const m = report.request.market;
  const watching = useOffice((s) => s.watchlist.some((w) => w.symbol === report.request.symbol));
  const toggleWatch = useOffice((s) => s.toggleWatch);
  const createAlerts = useOffice((s) => s.createAlerts);
  const notify = useOffice((s) => s.notify);
  const liveFeed = useOffice((s) => s.provider.status?.supportsLivePrices ?? false);
  const [full, setFull] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const chart = useCandles(report.request.symbol, report.request.market, report.request.timeframe, 120);
  const actionable = report.status === "BUY_SETUP" || report.status === "SELL_SETUP";

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportToMarkdown(report));
      flash("Laporan disalin ke clipboard.");
    } catch {
      flash("Clipboard tidak tersedia di browser ini.");
    }
  };

  const exportReport = (fmt: "md" | "json") => {
    const base = `${report.request.symbol}-${report.request.timeframe}-${new Date(report.createdAt).toISOString().slice(0, 16).replace(/[:T]/g, "")}`;
    if (fmt === "md") downloadFile(`${base}.md`, reportToMarkdown(report), "text/markdown");
    else downloadFile(`${base}.json`, JSON.stringify(report, null, 2), "application/json");
  };

  const alert = () => {
    const n = createAlerts(report);
    flash(liveFeed ? `${n} price alert aktif.` : `${n} alert disimpan tetapi TIDAK aktif: belum ada feed harga live (mode DEMO).`);
  };

  /** On-demand check (not a live alert): is the scenario still valid now? */
  const revalidate = async () => {
    if (!actionable || report.stopLoss === null || !report.entryZone) return;
    setChecking(true);
    try {
      const q = await api.quote(report.request.symbol, m);
      const long = report.status === "BUY_SETUP";
      const broken = long ? q.lastPrice <= report.stopLoss : q.lastPrice >= report.stopLoss;
      const hitTp1 = long ? q.lastPrice >= report.takeProfits[0] : q.lastPrice <= report.takeProfits[0];
      if (broken) {
        notify({ at: Date.now(), symbol: report.request.symbol, kind: "scenario_invalid", summary: `Harga ${formatPrice(q.lastPrice, m)} melewati stop loss ${formatPrice(report.stopLoss, m)} — skenario tidak lagi valid.`, urgency: "high", reportId: report.id, isDemo: q.source.isDemo });
        flash("Skenario TIDAK lagi valid — lihat notifikasi.");
      } else if (hitTp1) {
        flash(`Harga ${formatPrice(q.lastPrice, m)} sudah mencapai TP1. Jalankan analisis ulang sebelum mengambil keputusan.`);
      } else {
        flash(`Harga saat ini ${formatPrice(q.lastPrice, m)} (${formatTime(q.timestamp)}) — level invalidasi belum tersentuh.`);
      }
    } catch (e) {
      flash(`Gagal memeriksa harga: ${(e as Error).message}`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-4">
      {report.isDemo && (
        <div className="flex items-start gap-2 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-xs text-warn">
          <DemoBadge className="mt-0.5" />
          <span>Laporan ini dibuat dari data DEMO (simulasi). Harga, berita, dan level di bawah tidak mencerminkan pasar nyata dan tidak boleh dipakai untuk trading.</span>
        </div>
      )}

      {/* Header */}
      <Panel className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{report.request.symbol}</h1>
              <SignalBadge status={report.status} className="px-2 py-1 text-xs" />
              {report.isDemo && <DemoBadge />}
            </div>
            <p className="mt-1 text-sm text-muted">
              {report.quote.stock.name} · {report.quote.stock.sector} · {m}
            </p>
          </div>
          <div className="text-right">
            <div className="tabular text-2xl font-semibold">
              {formatPrice(report.quote.lastPrice, m)} <span className="text-xs font-normal text-muted">{report.quote.stock.currency}</span>
            </div>
            <div className={cn("tabular text-xs", report.quote.change >= 0 ? "text-bull" : "text-bear")}>
              {report.quote.change >= 0 ? "+" : ""}
              {formatPrice(report.quote.change, m)} ({report.quote.changePct.toFixed(2)}%)
            </div>
            <div className="mt-0.5 text-[11px] text-subtle">Data harga: {formatTime(report.quote.timestamp)}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="primary" onClick={() => setFull((f) => !f)}>
            <ChevronDown className={cn("size-3.5 transition-transform", full && "rotate-180")} /> {full ? "Ringkas" : "View Full Analysis"}
          </Button>
          <Button size="sm" onClick={() => toggleWatch(report.request.symbol, m)}>
            <Star className={cn("size-3.5", watching && "fill-warn text-warn")} /> {watching ? "Di watchlist" : "Add to Watchlist"}
          </Button>
          <Button size="sm" onClick={alert} disabled={!actionable} title={actionable ? undefined : "Tidak ada level untuk dipantau"}>
            <BellPlus className="size-3.5" /> Create Price Alert
          </Button>
          <Button size="sm" onClick={copy}>
            <ClipboardCopy className="size-3.5" /> Copy Report
          </Button>
          <Button size="sm" onClick={() => exportReport("md")}>
            <Download className="size-3.5" /> Export (.md)
          </Button>
          <Button size="sm" variant="ghost" onClick={() => exportReport("json")}>
            JSON
          </Button>
          {actionable && (
            <Button size="sm" variant="ghost" onClick={revalidate} disabled={checking}>
              <RefreshCw className={cn("size-3.5", checking && "animate-spin")} /> Cek validitas sekarang
            </Button>
          )}
        </div>
        {toast && (
          <p role="status" className="mt-3 rounded-lg bg-panel-2 px-3 py-2 text-xs text-fg">
            {toast}
          </p>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Market Data" kind="data">
          <dl className="divide-y divide-line">
            <Row label="Last price" value={formatPrice(report.quote.lastPrice, m)} />
            <Row label="Data timestamp" value={formatTime(report.quote.timestamp)} />
            {report.quote.delayMinutes !== undefined && <Row label="Delay bursa" value={`${report.quote.delayMinutes} menit`} />}
            {report.quote.marketOpen !== undefined && <Row label="Status pasar" value={report.quote.marketOpen ? "Sesi berjalan" : "Tutup (data sesi terakhir)"} />}
            <Row label="Timeframe" value={report.request.timeframe} />
            <Row label="Candle terakhir" value={formatTime(report.technical.dataTimestamp)} />
            <Row label="Sumber" value={<span className="text-xs">{report.sources.map((s) => s.name).join(", ")}</span>} />
          </dl>
        </Section>

        <Section title="Trade Scenario" kind="calc">
          {actionable && report.entryZone ? (
            <dl className="divide-y divide-line">
              <Row label="Entry zone" value={`${formatPrice(report.entryZone.low, m)} – ${formatPrice(report.entryZone.high, m)}`} tone="text-accent" />
              <Row label="Stop loss" value={formatPrice(report.stopLoss, m)} tone="text-bear" />
              {report.takeProfits.map((tp, i) => (
                <Row key={i} label={`Take profit ${i + 1}`} value={`${formatPrice(tp, m)} · ${report.riskReward[i]?.toFixed(2)}R`} tone="text-bull" />
              ))}
              {report.risk.position && (
                <Row
                  label={`Ukuran posisi (risiko ${report.risk.position.riskPct}%)`}
                  value={
                    <span className="text-xs">
                      {report.risk.position.lots !== null ? `${report.risk.position.lots} lot` : `${report.risk.position.shares} saham`} · maks rugi {formatMoney(report.risk.position.maxLoss, m)}
                    </span>
                  }
                />
              )}
            </dl>
          ) : (
            <div className="space-y-2 text-sm text-muted">
              <p>
                Status <strong className="text-fg">{report.status.replace("_", " ")}</strong>: tidak ada entry, SL, atau TP yang diterbitkan.
              </p>
              <p className="text-xs">{report.review.conflicts[0] ?? report.risk.issues[0] ?? "Kriteria setup belum terpenuhi."}</p>
            </div>
          )}
        </Section>

        <Section title="Confidence" kind="calc">
          <div className="flex items-end gap-2">
            <span className="tabular text-3xl font-semibold">{report.confidence.score}</span>
            <span className="pb-1 text-xs text-muted">/100 · {report.confidence.label}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${report.confidence.score}%` }} />
          </div>
          <ul className="mt-3 space-y-1 text-xs">
            {report.confidence.factors.map((f) => (
              <li key={f.label} className="flex justify-between gap-3">
                <span className="text-muted">{f.label}</span>
                <span className={cn("tabular", f.impact > 0 ? "text-bull" : f.impact < 0 ? "text-bear" : "text-subtle")}>
                  {f.impact > 0 ? "+" : ""}
                  {f.impact}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-subtle">{report.confidence.explanation}</p>
        </Section>
      </div>

      <Panel>
        <PanelHeader
          title="Grafik harga saat ini"
          subtitle="Data terbaru dari provider — bisa berbeda dari kondisi saat laporan dibuat."
          action={chart.data?.source.isDemo ? <DemoBadge /> : undefined}
        />
        <div className="p-3">
          {chart.data ? (
            <StockChart candles={chart.data.candles} market={m} timeframe={report.request.timeframe} levels={actionable ? { entryZone: report.entryZone, stopLoss: report.stopLoss, takeProfits: report.takeProfits } : null} />
          ) : (
            <div className="grid h-[320px] place-items-center text-xs text-subtle">{chart.error ?? "Memuat grafik…"}</div>
          )}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Why This Setup?" kind="ai">
          <ul className="space-y-1.5 text-sm text-muted">
            {report.reasons.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-accent" />
                {r}
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Invalidation Conditions & Risks" kind="ai">
          <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-subtle">Membatalkan skenario</h3>
          <ul className="space-y-1 text-sm text-muted">
            {report.invalidation.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
          <h3 className="mb-1.5 mt-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-subtle">
            <ShieldAlert className="size-3.5 text-warn" /> Risiko utama
          </h3>
          <ul className="space-y-1 text-sm text-muted">
            {report.mainRisks.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
          <p className="mt-4 rounded-lg bg-panel-2 p-3 text-xs text-muted">
            <span className="font-medium text-fg">Skenario alternatif: </span>
            {report.alternativeScenario}
          </p>
        </Section>
      </div>

      <AgentResults report={report} />

      {full && <FullAnalysis report={report} />}

      <p className="rounded-xl border border-line bg-panel px-4 py-3 text-xs text-muted">
        {report.disclaimer} Laporan dibuat {formatTime(report.createdAt)} · ID {report.id.slice(0, 8)}.
      </p>
    </div>
  );
}

function FullAnalysis({ report }: { report: FinalReport }) {
  const m = report.request.market;
  const ind = report.technical.indicators;
  const fmt = (v: number | null, d = 2) => (v === null ? "—" : v.toFixed(d));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Technical detail" kind="calc">
        <dl className="grid grid-cols-2 gap-x-6 divide-line">
          <Row label="SMA20" value={formatPrice(ind.sma20, m)} />
          <Row label="SMA50" value={formatPrice(ind.sma50, m)} />
          <Row label="EMA200" value={formatPrice(ind.ema200, m)} />
          <Row label="RSI14" value={fmt(ind.rsi14, 1)} />
          <Row label="MACD" value={fmt(ind.macd)} />
          <Row label="MACD hist" value={fmt(ind.macdHist)} />
          <Row label="ATR14" value={fmt(ind.atr14)} />
          <Row label="Volume / avg20" value={fmt(ind.volumeRatio)} />
        </dl>
        <div className="mt-3 text-xs text-muted">
          <div>Support: {report.technical.supports.map((v) => formatPrice(v, m)).join(", ") || "—"}</div>
          <div>Resistance: {report.technical.resistances.map((v) => formatPrice(v, m)).join(", ") || "—"}</div>
        </div>
        <h3 className="mb-1 mt-4 text-xs font-medium uppercase tracking-wider text-subtle">Metode</h3>
        <ul className="space-y-1 text-xs text-muted">
          {report.technical.methods.map((x, i) => (
            <li key={i}>• {x}</li>
          ))}
        </ul>
      </Section>

      <RiskAssessmentPanel report={report} />

      <Section title="News reviewed" kind="data" className="lg:col-span-2">
        <ul className="divide-y divide-line">
          {report.news.items.map((n) => (
            <li key={n.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm">
              <Badge className={cn(n.sentiment === "positive" ? "border-bull/40 text-bull" : n.sentiment === "negative" ? "border-bear/40 text-bear" : "border-line-strong text-muted")}>{n.sentiment}</Badge>
              <span className="min-w-0 flex-1">{n.headline}</span>
              <span className="text-[11px] text-subtle">
                {n.publisher} · {formatTime(n.publishedAt)} · dampak {n.impact}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-subtle">Metode: {report.news.method}</p>
      </Section>

      <Section title="Reviewer checks" kind="calc" className="lg:col-span-2">
        <ul className="grid gap-2 sm:grid-cols-2">
          {report.review.checks.map((c) => (
            <li key={c.label} className="rounded-lg bg-panel-2 p-3 text-xs">
              <div className={cn("font-medium", c.passed ? "text-bull" : "text-warn")}>
                {c.passed ? "✓" : "!"} {c.label}
              </div>
              <div className="mt-0.5 text-muted">{c.detail}</div>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
