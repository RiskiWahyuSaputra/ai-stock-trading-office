"use client";

import { useEffect } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import { currentPrayerBreak, PRAYER_CITIES } from "@/lib/prayer-times";
import { DEFAULT_PRAYER, useOffice } from "./office-store";

const CHECK_MS = 10_000;

export function prayerSettings() {
  const p = useOffice.getState().settings.prayer ?? DEFAULT_PRAYER;
  return { ...p, city: PRAYER_CITIES.find((c) => c.id === p.cityId) ?? PRAYER_CITIES[0] };
}

/** Keeps `prayerBreak` in the store in sync with the clock and the prayer settings. */
export function usePrayerSchedule() {
  const hydrated = useHydrated();
  const prayer = useOffice((s) => s.settings.prayer);

  useEffect(() => {
    if (!hydrated) return;
    const check = () => {
      const { enabled, city, minutes } = prayerSettings();
      useOffice.getState().setPrayerBreak(enabled ? currentPrayerBreak(Date.now(), city, minutes) : null);
    };
    check();
    const id = setInterval(check, CHECK_MS);
    return () => clearInterval(id);
  }, [hydrated, prayer]);
}
