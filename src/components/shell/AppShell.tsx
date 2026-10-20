"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAutopilot } from "@/lib/store/autopilot";
import { useOffice } from "@/lib/store/office-store";
import { usePrayerSchedule } from "@/lib/store/prayer";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

const PROVIDER_POLL_MS = 60_000;

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const checkProvider = useOffice((s) => s.checkProvider);
  useAutopilot();
  usePrayerSchedule();

  useEffect(() => {
    void useOffice.persist.rehydrate();
    void checkProvider();
    const id = setInterval(() => void checkProvider(), PROVIDER_POLL_MS);
    return () => clearInterval(id);
  }, [checkProvider]);

  return (
    <div className="flex h-full">
      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      {menuOpen && (
        <button className="fixed inset-0 z-30 bg-black/50 lg:hidden" aria-label="Tutup menu" onClick={() => setMenuOpen(false)} />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav onMenu={() => setMenuOpen(true)} />
        <main className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
