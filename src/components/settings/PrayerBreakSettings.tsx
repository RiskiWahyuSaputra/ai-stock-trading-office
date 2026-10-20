"use client";

import { useEffect, useState } from "react";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/Segmented";
import { localDate, PRAYER_CITIES, PRAYER_LABEL, prayerTimes, type PrayerName } from "@/lib/prayer-times";
import { DEFAULT_PRAYER, useOffice } from "@/lib/store/office-store";
import { cn } from "@/lib/utils";

/** Break schedule at the five prayer times, with today's times for the chosen city. */
export function PrayerBreakSettings() {
  const prayer = useOffice((s) => s.settings.prayer ?? DEFAULT_PRAYER);
  const prayerBreak = useOffice((s) => s.prayerBreak);
  const update = useOffice((s) => s.updateSettings);
  const city = PRAYER_CITIES.find((c) => c.id === prayer.cityId) ?? PRAYER_CITIES[0];
  const set = (p: Partial<typeof prayer>) => update({ prayer: { ...prayer, ...p } });

  // Today's times depend on the clock, so they are computed after mount.
  const [today, setToday] = useState<Record<PrayerName, number> | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setToday(prayerTimes(localDate(city.tz, Date.now()), city)), 0);
    return () => clearTimeout(id);
  }, [city]);
  const hhmm = (ms: number) => new Intl.DateTimeFormat("id-ID", { timeZone: city.tz, hour: "2-digit", minute: "2-digit" }).format(ms);

  return (
    <Panel>
      <PanelHeader
        title="Istirahat jam sholat"
        subtitle="Di 5 waktu sholat seluruh tim istirahat (ngopi, jalan-jalan). Autopilot berhenti dan tugas baru dijadwalkan setelahnya."
      />
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <Segmented
          label="Istirahat otomatis"
          value={prayer.enabled ? "on" : "off"}
          onChange={(v) => set({ enabled: v === "on" })}
          options={[
            { value: "on", label: "Aktif" },
            { value: "off", label: "Nonaktif" },
          ]}
        />
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Kota (jadwal Kemenag RI)</span>
          <select
            value={city.id}
            onChange={(e) => set({ cityId: e.target.value })}
            className="h-9 w-full rounded-lg border border-line-strong bg-bg px-2 text-sm focus:border-accent focus:outline-none"
          >
            {PRAYER_CITIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <Segmented
          label="Lama istirahat"
          value={String(prayer.minutes)}
          onChange={(v) => set({ minutes: Number(v) })}
          options={["10", "15", "20", "30"].map((m) => ({ value: m, label: `${m} mnt` }))}
        />
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted">Jadwal hari ini · {city.name}</div>
          <div className="tabular grid grid-cols-5 gap-1 text-center text-[11px]">
            {(Object.keys(PRAYER_LABEL) as PrayerName[]).map((n) => (
              <div key={n} className={cn("rounded-md bg-panel-2 px-1 py-1.5", prayerBreak?.name === n && "ring-1 ring-accent")}>
                <div className="text-subtle">{PRAYER_LABEL[n]}</div>
                <div className="font-medium text-fg">{today ? hhmm(today[n]) : "—"}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-subtle sm:col-span-2">
          Dihitung astronomis dengan kriteria Kemenag (Subuh 20°, Isya 18°, Ashar Syafi&apos;i, ihtiyat 2 menit); bisa berbeda ±1 menit dari jadwal masjid setempat.
          Jumat siang istirahat 45 menit.
        </p>
      </div>
    </Panel>
  );
}
