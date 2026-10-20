"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button, DemoBadge, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { PrayerBreakSettings } from "@/components/settings/PrayerBreakSettings";
import { Segmented } from "@/components/ui/Segmented";
import { useOffice } from "@/lib/store/office-store";

const TIMEZONES = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "Asia/Singapore", "America/New_York", "Europe/London", "UTC"];

export default function SettingsPage() {
  const settings = useOffice((s) => s.settings);
  const update = useOffice((s) => s.updateSettings);
  const provider = useOffice((s) => s.provider);
  const [confirmReset, setConfirmReset] = useState(false);

  const reset = () => {
    useOffice.persist.clearStorage();
    window.location.reload();
  };

  return (
    <div className="page-enter mx-auto max-w-3xl space-y-4 p-3 sm:p-4">
      <PageHeader title="Settings" description="Preferensi kantor dan parameter risiko. Disimpan di perangkat ini." />

      <Panel>
        <PanelHeader title="Pasar & tampilan" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Segmented label="Pasar utama" value={settings.market} onChange={(market) => update({ market })} options={[{ value: "IDX", label: "IDX" }, { value: "US", label: "US" }]} />
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Zona waktu jam</span>
            <select
              value={settings.timezone}
              onChange={(e) => update({ timezone: e.target.value })}
              className="h-9 w-full rounded-lg border border-line-strong bg-bg px-2 text-sm focus:border-accent focus:outline-none"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz}>{tz}</option>
              ))}
            </select>
          </label>
          <Segmented label="Tampilan kantor" value={settings.view} onChange={(view) => update({ view })} options={[{ value: "auto", label: "Otomatis" }, { value: "3d", label: "3D" }, { value: "2d", label: "2D (hemat)" }]} />
        </div>
      </Panel>

      <PrayerBreakSettings />

      <Panel>
        <PanelHeader title="Default analisis & risiko" subtitle="Dipakai Risk Manager untuk menghitung ukuran posisi." />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Segmented label="Timeframe default" value={settings.timeframe} onChange={(timeframe) => update({ timeframe })} options={[{ value: "1h", label: "1H" }, { value: "4h", label: "4H" }, { value: "1D", label: "1D" }, { value: "1W", label: "1W" }]} />
          <Segmented label="Mode default" value={settings.mode} onChange={(mode) => update({ mode })} options={[{ value: "conservative", label: "Konservatif" }, { value: "balanced", label: "Seimbang" }, { value: "aggressive", label: "Agresif" }]} />
          {(["IDX", "US"] as const).map((m) => (
            <label key={m} className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted">Modal {m} ({m === "IDX" ? "IDR" : "USD"})</span>
              <input
                type="number"
                min={1}
                value={settings.accountSize[m]}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v > 0) update({ accountSize: { ...settings.accountSize, [m]: v } });
                }}
                className="tabular h-9 w-full rounded-lg border border-line-strong bg-bg px-3 text-sm focus:border-accent focus:outline-none"
              />
            </label>
          ))}
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Risiko per trade (%), maks 10</span>
            <input
              type="number"
              min={0.1}
              max={10}
              step={0.1}
              value={settings.riskPct}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v > 0 && v <= 10) update({ riskPct: v });
              }}
              className="tabular h-9 w-full rounded-lg border border-line-strong bg-bg px-3 text-sm focus:border-accent focus:outline-none"
            />
          </label>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Sumber data & integrasi" subtitle="Dikonfigurasi di server lewat environment variables." />
        <dl className="space-y-2 p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Market data</dt>
            <dd className="flex items-center gap-2">{provider.status?.market.name ?? "—"} {provider.status?.market.isDemo && <DemoBadge />}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Berita</dt>
            <dd className="flex items-center gap-2">{provider.status?.news.name ?? "—"} {provider.status?.news.isDemo && <DemoBadge />}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Feed harga live</dt>
            <dd>{provider.status?.supportsLivePrices ? "Ya" : "Tidak — price alert nonaktif"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">LLM</dt>
            <dd className="text-right text-xs">{provider.status?.llm.note ?? "—"}</dd>
          </div>
          <p className="pt-2 text-xs text-subtle">
            Set <code className="text-muted">MARKET_DATA_PROVIDER</code> dan <code className="text-muted">NEWS_PROVIDER</code> di <code className="text-muted">.env.local</code>. API key hanya dibaca di server.
          </p>
        </dl>
      </Panel>

      <Panel className="p-4">
        <h2 className="text-sm font-semibold">Reset data lokal</h2>
        <p className="mt-1 text-xs text-muted">Menghapus laporan, watchlist, notifikasi, alert, dan pengaturan dari perangkat ini.</p>
        {confirmReset ? (
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="danger" onClick={reset}>
              Ya, hapus semua
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
              Batal
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => setConfirmReset(true)}>
            <RotateCcw className="size-3.5" /> Reset
          </Button>
        )}
      </Panel>
    </div>
  );
}
