"use client";

import { AlertCircle, ArrowUpRight, CalendarClock, Clock, Play, Radar, Search, Square, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button, DemoBadge, EmptyState, PageHeader, Panel, PanelHeader, ProgressBar, SignalBadge, Stat } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/Segmented";
import { compareCandidates } from "@/lib/agents/entry-planner";
import { MIN_RR } from "@/lib/agents/risk-manager";
import type { AnalysisMode, EntryTiming, Market, ScreenItem } from "@/lib/domain/schemas";
import { formatTradingDay, marketStatus } from "@/lib/market-hours";
import { useOffice } from "@/lib/store/office-store";
import { cn, formatPrice, formatTime } from "@/lib/utils";

type Universe = "IDX" | "US" | "watchlist";

const AUTO_SCAN_MS = 30 * 60_000;

const MODES: { value: AnalysisMode; label: string; hint: string }[] = [
  { value: "conservative", label: "Konservatif", hint: `Min R/R ${MIN_RR.conservative}` },
  { value: "balanced", label: "Seimbang", hint: `Min R/R ${MIN_RR.balanced}` },
  { value: "aggressive", label: "Agresif", hint: `Min R/R ${MIN_RR.aggressive}` },
];

const TRIGGER_LABEL: Record<ScreenItem["plan"]["trigger"], string> = {
  in_zone: "Di zona entry",
  pullback: "Tunggu pullback",
  breakout: "Tunggu breakout",
  confirmation: "Tunggu konfirmasi",
  none: "—",
};

/**
 * Entry Radar — the team scans a whole market (or the watchlist) by itself
 * and groups buy entries by WHEN they can be taken. Every timing comes from
 * the deterministic Entry Planner; nothing here is a price forecast.
 */
export function EntryRadar() {
  const settings = useOffice((s) => s.settings);
  const watchlist = useOffice((s) => s.watchlist);
  const screener = useOffice((s) => s.screener);
  const startScreener = useOffice((s) => s.startScreener);
  const cancelScreener = useOffice((s) => s.cancelScreener);
  const updateSettings = useOffice((s) => s.updateSettings);

  const [universe, setUniverse] = useState<Universe>(settings.market);
  const [mode, setMode] = useState<AnalysisMode>(settings.mode);
  const running = screener?.phase === "running";
  const market: Market = universe === "watchlist" ? settings.market : universe;
  const watchSymbols = watchlist.filter((w) => w.market === market).map((w) => w.symbol);

  const scan = () => {
    if (universe === "watchlist" && watchSymbols.length === 0) return;
    void startScreener({ market, mode, symbols: universe === "watchlist" ? watchSymbols : undefined });
  };

  // Auto scan: re-run the last scan while this page is open and its market is in session.
  const autoScan = settings.autoScan ?? false;
  useEffect(() => {
    if (!autoScan) return;
    const id = setInterval(() => {
      const { screener: sc, startScreener: start } = useOffice.getState();
      if (!sc || sc.phase === "running" || !marketStatus(sc.request.market).open) return;
      void start({ market: sc.request.market, mode: sc.request.mode, symbols: sc.request.symbols });
    }, AUTO_SCAN_MS);
    return () => clearInterval(id);
  }, [autoScan]);

  const items = [...(screener?.items ?? [])].sort(compareCandidates);
  const group = (t: EntryTiming) => items.filter((i) => i.plan.timing === t);
  const today = group("today");
  const next = group("next_session");
  const later = group("later");
  const avoid = group("avoid");
  const m = screener?.request.market ?? market;
  const nextLabel = screener?.nextDay ? formatTradingDay(screener.nextDay) : "sesi berikutnya";

  return (
    <div className="page-enter space-y-4 p-3 sm:p-4">
      <PageHeader
        title="Entry Radar"
        description="Tim AI memindai saham sendiri dan memilah kapan entry beli bisa dilakukan: hari ini, sesi berikutnya, atau nanti."
      />

      <Panel className="p-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <Segmented
            label="Saham yang dipindai"
            value={universe}
            onChange={setUniverse}
            disabled={running}
            options={[
              { value: "IDX", label: "Semua IDX", hint: "Seluruh direktori saham IDX terverifikasi" },
              { value: "US", label: "Semua US", hint: "Seluruh direktori saham US terverifikasi" },
              { value: "watchlist", label: `Watchlist ${settings.market}`, hint: `${watchSymbols.length} saham di watchlist` },
            ]}
          />
          <Segmented label="Profil risiko" value={mode} onChange={setMode} options={MODES} disabled={running} />
          {running ? (
            <Button variant="danger" onClick={cancelScreener}>
              <Square className="size-4" /> Hentikan
            </Button>
          ) : (
            <Button variant="primary" onClick={scan} disabled={universe === "watchlist" && watchSymbols.length === 0}>
              <Play className="size-4" /> Mulai scan
            </Button>
          )}
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            className="accent-[var(--accent)]"
            checked={autoScan}
            onChange={(e) => updateSettings({ autoScan: e.target.checked })}
          />
          Scan ulang otomatis tiap 30 menit selama bursa buka (halaman ini harus tetap terbuka).
        </label>
        {universe === "watchlist" && watchSymbols.length === 0 && (
          <p className="mt-2 text-xs text-warn">Watchlist {settings.market} masih kosong — tambahkan saham dari halaman Watchlist.</p>
        )}
      </Panel>

      {screener && (
        <Panel className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span className="flex items-center gap-2">
              <Radar className={cn("size-4 text-accent", running && "animate-pulse")} />
              {running
                ? `Memindai ${screener.done}/${screener.total || "…"} saham ${screener.request.market}…`
                : screener.phase === "completed"
                  ? `Scan selesai: ${screener.items.length} saham dianalisis${screener.errors.length ? `, ${screener.errors.length} gagal` : ""}.`
                  : `Scan berhenti: ${screener.error}`}
              {screener.isDemo && <DemoBadge />}
            </span>
            <span className="tabular">
              {screener.sessionLabel && `${screener.request.market}: ${screener.sessionLabel} · `}
              {formatTime(screener.finishedAt ?? screener.startedAt, settings.timezone)}
            </span>
          </div>
          <ProgressBar className="mt-3" value={screener.total ? (screener.done / screener.total) * 100 : 0} />
        </Panel>
      )}

      {!screener ? (
        <Panel>
          <EmptyState icon={<Radar className="size-8" />} title="Belum ada hasil scan">
            Pilih pasar lalu tekan <b>Mulai scan</b>. Setiap saham dianalisis dengan candle harian oleh News Researcher, Technical Analyst, Risk
            Manager dan Signal Reviewer, lalu Entry Planner menentukan waktunya.
          </EmptyState>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Panel className="p-4"><Stat label="Entry hari ini" value={<span className="text-bull">{today.length}</span>} hint="Harga di zona, sesi masih berjalan" /></Panel>
            <Panel className="p-4"><Stat label="Sesi berikutnya" value={<span className="text-accent">{next.length}</span>} hint={nextLabel} /></Panel>
            <Panel className="p-4"><Stat label="Pantau (nanti)" value={<span className="text-warn">{later.length}</span>} hint="Menunggu pullback/breakout/konfirmasi" /></Panel>
            <Panel className="p-4"><Stat label="Dihindari" value={avoid.length} hint="Tren turun, sideways, atau data kurang" /></Panel>
          </div>

          <Section
            icon={<Clock className="size-4 text-bull" />}
            title="Bisa entry hari ini"
            subtitle={screener.today ? `${formatTradingDay(screener.today)} (tanggal bursa ${screener.request.market}) — setup BUY disetujui dan harga sudah di zona entry.` : undefined}
            items={today}
            market={m}
            empty="Tidak ada saham yang memenuhi semua syarat entry untuk sesi hari ini."
          />
          <Section
            icon={<CalendarClock className="size-4 text-accent" />}
            title={`Sesi berikutnya · ${nextLabel}`}
            subtitle="Setup siap tetapi pasar sudah tutup, atau tinggal menunggu konfirmasi close hari ini."
            items={next}
            market={m}
            empty="Tidak ada kandidat untuk sesi berikutnya."
          />
          <Section
            icon={<Search className="size-4 text-warn" />}
            title="Pantau — beberapa hari lagi"
            subtitle="Estimasi hari bursa = jarak harga ÷ ATR14 (rata-rata gerak harian). Perkiraan kasar, bukan ramalan."
            items={later}
            market={m}
            empty="Tidak ada saham dalam daftar pantau."
          />

          {avoid.length > 0 && (
            <details className="group rounded-xl border border-line bg-panel">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-muted hover:text-fg">
                Dihindari ({avoid.length}) <span className="text-xs font-normal">— klik untuk melihat</span>
              </summary>
              <ul className="divide-y divide-line border-t border-line text-xs">
                {avoid.map((i) => (
                  <li key={i.stock.symbol} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
                    <span className="w-14 font-semibold text-fg">{i.stock.symbol}</span>
                    <span className="tabular w-24 text-muted">{formatPrice(i.lastPrice, m)}</span>
                    <span className="min-w-0 flex-1 text-muted">{i.plan.headline}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {screener.errors.length > 0 && (
            <details className="rounded-xl border border-bear/30 bg-bear/5">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm text-bear">
                <AlertCircle className="size-4" /> {screener.errors.length} saham gagal dianalisis
              </summary>
              <ul className="space-y-1 px-4 pb-3 text-xs text-muted">
                {screener.errors.map((e) => (
                  <li key={e.symbol}>
                    <b className="text-fg">{e.symbol}</b>: {e.error}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      <p className="text-[11px] leading-relaxed text-subtle">
        Entry Radar hanya merencanakan entry beli berdasarkan aturan deterministik dan data delayed. Waktu &quot;hari ini/besok&quot; memakai jadwal
        reguler bursa tanpa hari libur. Ini analisis informasional, bukan saran investasi, dan tidak ada transaksi yang dieksekusi.
      </p>
    </div>
  );
}

function Section({ icon, title, subtitle, items, market, empty }: { icon: ReactNode; title: string; subtitle?: string; items: ScreenItem[]; market: Market; empty: string }) {
  return (
    <Panel className="overflow-hidden">
      <PanelHeader title={<span className="flex items-center gap-2">{icon} {title} <span className="text-muted">({items.length})</span></span>} subtitle={subtitle} />
      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted">{empty}</p>
      ) : (
        <div className="grid gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
          {items.map((i) => (
            <RadarCard key={i.stock.symbol} item={i} market={market} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function RadarCard({ item, market }: { item: ScreenItem; market: Market }) {
  const router = useRouter();
  const saveScreenReport = useOffice((s) => s.saveScreenReport);
  const toggleWatch = useOffice((s) => s.toggleWatch);
  const watched = useOffice((s) => s.watchlist.some((w) => w.symbol === item.stock.symbol));
  const { plan, report } = item;
  const levels = report?.entryZone && report.stopLoss !== null;

  const openReport = () => {
    const id = saveScreenReport(item);
    if (id) router.push(`/signals/${id}`);
  };

  return (
    <div className="flex flex-col rounded-xl border border-line bg-panel-2/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-base font-semibold">{item.stock.symbol}</span>
            <SignalBadge status={item.status} />
            {report?.isDemo && <DemoBadge />}
          </div>
          <div className="truncate text-xs text-muted">{item.stock.name}</div>
        </div>
        <div className="text-right">
          <div className="tabular text-sm font-semibold">{formatPrice(item.lastPrice, market)}</div>
          <div className={cn("tabular text-[11px]", item.changePct >= 0 ? "text-bull" : "text-bear")}>
            {item.changePct >= 0 ? "+" : ""}
            {item.changePct.toFixed(2)}%
          </div>
        </div>
      </div>

      <p className="mt-2 text-sm text-fg">{plan.headline}</p>

      <dl className="tabular mt-2 grid grid-cols-3 gap-1.5 text-[11px]">
        <Cell label={TRIGGER_LABEL[plan.trigger]} value={plan.triggerPrice !== null ? formatPrice(plan.triggerPrice, market) : "—"} />
        <Cell
          label="Kapan"
          value={plan.day ? formatTradingDay(plan.day) : plan.etaDays ? `±${plan.etaDays[0]}–${plan.etaDays[1]} hari bursa` : "Belum pasti"}
        />
        <Cell label="Konfluensi" value={`${item.confidence}/100`} />
        {levels && (
          <>
            <Cell label="Stop loss" value={<span className="text-bear">{formatPrice(report.stopLoss, market)}</span>} />
            <Cell label="TP1" value={<span className="text-bull">{formatPrice(report.takeProfits[0], market)}</span>} />
            <Cell label="R/R" value={report.riskReward.map((r) => r.toFixed(1)).join(" / ") || "—"} />
          </>
        )}
      </dl>

      {plan.reasons.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-muted">
          {plan.reasons.slice(0, 3).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-[11px]">
        <button
          onClick={() => toggleWatch(item.stock.symbol, market)}
          className={cn("inline-flex items-center gap-1", watched ? "text-warn" : "text-subtle hover:text-fg")}
          aria-pressed={watched}
        >
          <Star className={cn("size-3.5", watched && "fill-current")} /> {watched ? "Di watchlist" : "Watchlist"}
        </button>
        <div className="flex items-center gap-3">
          <Link href={`/analyze?${new URLSearchParams({ symbol: item.stock.symbol, market })}`} className="text-muted hover:text-fg">
            Analisis ulang
          </Link>
          {report && (
            <button onClick={openReport} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
              Laporan <ArrowUpRight className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-panel p-1.5">
      <dt className="truncate text-subtle">{label}</dt>
      <dd className="mt-0.5 truncate font-medium">{value}</dd>
    </div>
  );
}
