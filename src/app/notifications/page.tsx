"use client";

import { BellOff, CheckCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { KIND_LABEL, NotificationItem } from "@/components/notifications/NotificationCenter";
import { Button, EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/Segmented";
import { useOffice } from "@/lib/store/office-store";

type Filter = "all" | "unread" | "high";

export default function NotificationsPage() {
  const notifications = useOffice((s) => s.notifications);
  const markAllRead = useOffice((s) => s.markAllRead);
  const clear = useOffice((s) => s.clearNotifications);
  const live = useOffice((s) => s.provider.status?.supportsLivePrices ?? false);
  const alerts = useOffice((s) => s.alerts);
  const removeAlert = useOffice((s) => s.removeAlert);
  const [filter, setFilter] = useState<Filter>("all");

  const shown = notifications.filter((n) => (filter === "unread" ? !n.read : filter === "high" ? n.urgency === "high" : true));

  return (
    <div className="page-enter mx-auto max-w-4xl space-y-4 p-3 sm:p-4">
      <PageHeader
        title="Notification Center"
        description="Pemberitahuan dari Final Signal Officer dan sistem."
        actions={
          <>
            <Button size="sm" onClick={markAllRead}>
              <CheckCheck className="size-3.5" /> Tandai dibaca
            </Button>
            <Button size="sm" variant="ghost" onClick={clear}>
              <Trash2 className="size-3.5" /> Hapus semua
            </Button>
          </>
        }
      />
      <div className="max-w-sm">
        <Segmented label="Filter" value={filter} onChange={setFilter} options={[{ value: "all", label: "Semua" }, { value: "unread", label: "Belum dibaca" }, { value: "high", label: "Urgensi tinggi" }]} />
      </div>

      <Panel className="divide-y divide-line overflow-hidden">
        {shown.length === 0 ? (
          <EmptyState icon={<BellOff className="size-8" />} title="Tidak ada notifikasi">
            Jenis yang didukung: {Object.values(KIND_LABEL).join(", ")}.
          </EmptyState>
        ) : (
          shown.map((n) => <NotificationItem key={n.id} n={n} />)
        )}
      </Panel>

      <Panel className="p-4">
        <h2 className="text-sm font-semibold">Price alerts</h2>
        <p className="mt-1 text-xs text-muted">
          {live
            ? "Feed harga live terhubung: alert aktif akan memicu notifikasi."
            : "Tidak ada feed harga live (mode DEMO). Alert disimpan tetapi tidak aktif, dan notifikasi harga real-time tidak disimulasikan."}
        </p>
        {alerts.length > 0 && (
          <ul className="mt-3 divide-y divide-line text-xs">
            {alerts.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2">
                <span className="w-14 font-semibold">{a.symbol}</span>
                <span className="w-20 text-muted">{a.label}</span>
                <span className="tabular flex-1">{a.level.toLocaleString("id-ID")}</span>
                <span className={a.active ? "text-bull" : "text-subtle"} title={a.inactiveReason}>
                  {a.active ? "Aktif" : "Tidak aktif"}
                </span>
                <button onClick={() => removeAlert(a.id)} className="text-subtle hover:text-bear" aria-label={`Hapus alert ${a.symbol} ${a.label}`}>
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
