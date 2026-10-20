"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DemoBadge } from "@/components/ui/primitives";
import { useOffice, type AppNotification, type NotificationKind } from "@/lib/store/office-store";
import { cn, timeAgo } from "@/lib/utils";

export const KIND_LABEL: Record<NotificationKind, string> = {
  analysis_complete: "Analisis selesai",
  report_ready: "Laporan final tersedia",
  analysis_failed: "Analisis gagal",
  needs_review: "Perlu review tambahan",
  important_news: "Berita penting",
  scenario_invalid: "Skenario tidak valid",
  data_delayed: "Data terlambat / tidak cukup",
  near_entry: "Harga mendekati entry",
  near_sl_tp: "Harga mendekati SL/TP",
  radar_ready: "Kandidat entry ditemukan",
};

export const URGENCY_TONE: Record<AppNotification["urgency"], string> = {
  low: "bg-subtle",
  medium: "bg-warn",
  high: "bg-bear",
};

export function NotificationItem({ n, onOpen }: { n: AppNotification; onOpen?: () => void }) {
  const markRead = useOffice((s) => s.markRead);
  return (
    <div className={cn("flex gap-3 px-4 py-3", !n.read && "bg-accent/5")}>
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", URGENCY_TONE[n.urgency])} title={`Urgensi ${n.urgency}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-fg">{n.symbol}</span>
          <span className="text-muted">· {KIND_LABEL[n.kind]}</span>
          {n.isDemo && <DemoBadge />}
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-muted">{n.summary}</p>
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-subtle">
          <span title={new Date(n.at).toLocaleString("id-ID")}>{timeAgo(n.at)}</span>
          {n.kind === "radar_ready" && (
            <Link href="/radar" className="font-medium text-accent hover:underline" onClick={() => { markRead(n.id); onOpen?.(); }}>
              Buka Entry Radar
            </Link>
          )}
          {n.reportId && (
            <Link
              href={`/signals/${n.reportId}`}
              className="font-medium text-accent hover:underline"
              onClick={() => {
                markRead(n.id);
                onOpen?.();
              }}
            >
              Open Report
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const notifications = useOffice((s) => s.notifications);
  const markAllRead = useOffice((s) => s.markAllRead);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        className="relative rounded-lg p-2 text-muted hover:bg-panel hover:text-fg"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifikasi (${unread} belum dibaca)`}
        aria-expanded={open}
      >
        <Bell className="size-4.5" />
        {unread > 0 && (
          <span className="tabular absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-bg">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-14 z-50 overflow-hidden rounded-xl border border-line bg-panel shadow-2xl shadow-black/50 sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-96">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="text-sm font-semibold">Notification Center</div>
            <button className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg" onClick={markAllRead}>
              <CheckCheck className="size-3.5" /> Tandai dibaca
            </button>
          </div>
          <div className="scrollbar-thin max-h-[60vh] divide-y divide-line overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-muted">Belum ada notifikasi. Jalankan analisis untuk menerima laporan dari Final Signal Officer.</p>
            ) : (
              notifications.slice(0, 20).map((n) => <NotificationItem key={n.id} n={n} onOpen={() => setOpen(false)} />)
            )}
          </div>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2.5 text-center text-xs text-accent hover:bg-panel-2">
            Lihat semua notifikasi
          </Link>
        </div>
      )}
    </div>
  );
}
