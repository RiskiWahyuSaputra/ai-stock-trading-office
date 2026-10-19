import { clsx, type ClassValue } from "clsx";
import type { Market, SignalStatus } from "@/lib/domain/schemas";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatPrice(v: number | null | undefined, market: Market) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return market === "IDX"
    ? v.toLocaleString("id-ID", { maximumFractionDigits: 0 })
    : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatMoney(v: number, market: Market) {
  return market === "IDX"
    ? `Rp${v.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`
    : `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function formatTime(ts: number, timeZone?: string, withDate = true) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: withDate ? undefined : "2-digit",
    day: withDate ? "2-digit" : undefined,
    month: withDate ? "short" : undefined,
    year: withDate ? "numeric" : undefined,
  }).format(ts);
}

export function timeAgo(ts: number, now = Date.now()) {
  const s = Math.round((now - ts) / 1000);
  if (s < 60) return `${s} dtk lalu`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} jam lalu`;
  return `${Math.round(h / 24)} hari lalu`;
}

export const SIGNAL_STYLE: Record<SignalStatus, { label: string; className: string }> = {
  BUY_SETUP: { label: "BUY SETUP", className: "bg-bull/15 text-bull border-bull/40" },
  SELL_SETUP: { label: "SELL SETUP", className: "bg-bear/15 text-bear border-bear/40" },
  WAIT: { label: "WAIT", className: "bg-warn/15 text-warn border-warn/40" },
  NO_TRADE: { label: "NO TRADE", className: "bg-subtle/15 text-muted border-line-strong" },
};
