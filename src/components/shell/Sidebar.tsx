"use client";

import {
  Bell,
  Building2,
  History,
  LineChart,
  ListChecks,
  Newspaper,
  Radar,
  Search,
  Settings,
  ShieldAlert,
  Star,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useOffice } from "@/lib/store/office-store";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/", label: "Office Overview", icon: Building2 },
  { href: "/employees", label: "AI Employees", icon: Users },
  { href: "/analyze", label: "Analyze Stock", icon: Search },
  { href: "/radar", label: "Entry Radar", icon: Radar },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/signals", label: "Final Signals", icon: ListChecks },
  { href: "/history", label: "Analysis History", icon: History },
  { href: "/news", label: "News Center", icon: Newspaper },
  { href: "/risk", label: "Risk Management", icon: ShieldAlert },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  open,
  onNavigate,
}: {
  open: boolean;
  onNavigate: () => void;
}) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-bg-elevated transition-transform lg:static lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
        <div className="grid size-8 place-items-center rounded-lg bg-accent/15 text-accent">
          <LineChart className="size-4.5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">AI Trading Office</div>
          <div className="text-[11px] text-subtle">Stock analysis team</div>
        </div>
      </div>
      <Suspense fallback={<NavList pathname={null} onNavigate={onNavigate} />}>
        <ActiveNavList onNavigate={onNavigate} />
      </Suspense>
      <div className="border-t border-line p-3 text-[11px] leading-relaxed text-subtle">
        Analisis informasional — bukan saran investasi. Tidak ada eksekusi
        transaksi otomatis.
      </div>
    </aside>
  );
}

/** usePathname is runtime data, so it lives behind a Suspense boundary. */
function ActiveNavList({ onNavigate }: { onNavigate: () => void }) {
  return <NavList pathname={usePathname()} onNavigate={onNavigate} />;
}

function NavList({
  pathname,
  onNavigate,
}: {
  pathname: string | null;
  onNavigate: () => void;
}) {
  const running = useOffice((s) => s.run?.phase === "running");
  const scanning = useOffice((s) => s.screener?.phase === "running");
  const unread = useOffice(
    (s) => s.notifications.filter((n) => !n.read).length,
  );
  return (
    <nav
      className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto p-2"
      aria-label="Navigasi utama"
    >
      {NAV.map(({ href, label, icon: Icon }) => {
        const active =
          pathname !== null &&
          (href === "/" ? pathname === "/" : pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-accent/10 text-accent"
                : "text-muted hover:bg-panel hover:text-fg",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1 truncate">{label}</span>
            {href === "/analyze" && running && (
              <span
                className="size-2 animate-pulse rounded-full bg-accent"
                aria-label="Analisis berjalan"
              />
            )}
            {href === "/radar" && scanning && (
              <span
                className="size-2 animate-pulse rounded-full bg-accent"
                aria-label="Scan berjalan"
              />
            )}
            {href === "/notifications" && unread > 0 && (
              <span className="tabular rounded-full bg-accent px-1.5 text-[10px] font-semibold text-bg">
                {unread}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
