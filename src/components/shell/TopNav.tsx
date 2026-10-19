"use client";

import { Menu, Settings as SettingsIcon, UserRound, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { DemoBadge } from "@/components/ui/primitives";
import { marketStatus } from "@/lib/market-hours";
import { useOffice } from "@/lib/store/office-store";
import { cn } from "@/lib/utils";

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function TopNav({ onMenu }: { onMenu: () => void }) {
  const now = useNow();
  const market = useOffice((s) => s.settings.market);
  const timezone = useOffice((s) => s.settings.timezone);
  const provider = useOffice((s) => s.provider);
  const status = now ? marketStatus(market, now) : null;
  const demo = provider.status?.market.isDemo ?? true;

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-bg-elevated/80 px-3 backdrop-blur sm:px-4">
      <button className="rounded-lg p-2 text-muted hover:bg-panel lg:hidden" onClick={onMenu} aria-label="Buka menu">
        <Menu className="size-5" />
      </button>

      <div className="flex min-w-0 items-center gap-2 text-xs">
        <span className="hidden font-medium text-fg sm:inline">{market === "IDX" ? "IDX" : "US Market"}</span>
        {status && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1",
              status.open ? "border-bull/40 text-bull" : "border-line-strong text-muted",
            )}
            title={`Jadwal reguler ${status.tz}; hari libur bursa tidak diperhitungkan.`}
          >
            <span className={cn("size-1.5 rounded-full", status.open ? "bg-bull" : "bg-subtle")} />
            {status.label}
          </span>
        )}
        {now && (
          <span className="tabular hidden text-muted md:inline" title={timezone}>
            {new Intl.DateTimeFormat("id-ID", { timeZone: timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(now)}{" "}
            <span className="text-subtle">{timezone.split("/").pop()?.replace("_", " ")}</span>
          </span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <span
          className={cn(
            "hidden items-center gap-1.5 rounded-md border px-2 py-1 text-xs sm:inline-flex",
            provider.ok ? "border-line-strong text-muted" : "border-bear/40 text-bear",
          )}
          title={provider.ok ? `${provider.status?.market.name} · ${provider.status?.news.name}` : provider.error ?? "Memeriksa koneksi…"}
        >
          {provider.ok ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
          {provider.ok ? "Data terhubung" : provider.checkedAt ? "Terputus" : "Memeriksa…"}
        </span>
        {provider.ok && demo && <DemoBadge />}
        <NotificationCenter />
        <Link href="/settings" className="rounded-lg p-2 text-muted hover:bg-panel hover:text-fg" aria-label="Pengaturan">
          <SettingsIcon className="size-4.5" />
        </Link>
        <div className="flex items-center gap-2 rounded-lg border border-line px-2 py-1">
          <div className="grid size-6 place-items-center rounded-full bg-accent/15 text-accent">
            <UserRound className="size-3.5" />
          </div>
          <div className="hidden leading-tight sm:block">
            <div className="text-xs font-medium">CEO</div>
            <div className="text-[10px] text-subtle">Office owner</div>
          </div>
        </div>
      </div>
    </header>
  );
}
