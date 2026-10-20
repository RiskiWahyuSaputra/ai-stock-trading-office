"use client";

import { Pause, Play, Radar } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useOffice } from "@/lib/store/office-store";
import { cn } from "@/lib/utils";

/** Live status of the office autopilot, with pause/resume and a manual-task shortcut. */
export function AutopilotBar() {
  const pilot = useOffice((s) => s.autopilot);
  const enabled = useOffice((s) => s.settings.autopilot ?? true);
  const screener = useOffice((s) => s.screener);
  const updateSettings = useOffice((s) => s.updateSettings);
  // Clock for the rest countdown; read only after mount (never during prerender).
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (pilot.phase !== "resting") return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [pilot.phase]);

  const text = !enabled
    ? "Autopilot dijeda — kantor hanya bekerja saat diberi tugas."
    : {
        off: "Autopilot bersiap…",
        scanning: `Memindai Entry Radar ${screener?.request.market ?? ""} ${screener?.phase === "running" ? `${screener.done}/${screener.total || "…"}` : ""}`,
        analyzing: `Analisis lengkap ${pilot.symbol} (${pilot.position}/${pilot.queueLength}) · putaran ${pilot.cycle}`,
        resting: now && pilot.nextAt ? `Istirahat ${Math.max(0, Math.ceil((pilot.nextAt - now) / 1000))} dtk, lalu lanjut` : "Istirahat sebentar, lalu lanjut",
        waiting: pilot.reason ?? "Menunggu",
      }[pilot.phase];
  const working = enabled && (pilot.phase === "scanning" || pilot.phase === "analyzing");

  return (
    <div className="glass pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs">
      <Radar className={cn("size-3.5 shrink-0", enabled ? "text-accent" : "text-subtle", working && "animate-pulse")} />
      <span className="font-semibold text-fg">Autopilot</span>
      <span className="min-w-0 truncate text-muted">{text}</span>
      <button
        onClick={() => updateSettings({ autopilot: !enabled })}
        className="inline-flex items-center gap-1 rounded-md border border-line-strong px-2 py-0.5 text-muted hover:text-fg"
      >
        {enabled ? <Pause className="size-3" /> : <Play className="size-3" />} {enabled ? "Jeda" : "Lanjutkan"}
      </button>
      <Link href="/analyze" className="text-accent hover:underline">
        Tugas manual
      </Link>
    </div>
  );
}
