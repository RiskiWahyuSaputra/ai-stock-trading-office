import { describe, expect, it } from "vitest";
import { currentPrayerBreak, nextPrayerBreak, PRAYER_CITIES, prayerTimes, type PrayerName } from "./prayer-times";

const jakarta = PRAYER_CITIES.find((c) => c.id === "jakarta")!;
const hhmm = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);
const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));

describe("prayer times", () => {
  it("matches the Kemenag RI schedule for Jakarta within a minute", () => {
    // Kemenag RI via liputan6.com/jadwal-sholat/kota-jakarta/2026/10 — 26 Oct 2026.
    const expected: Record<PrayerName, string> = { subuh: "04:11", dzuhur: "11:40", ashar: "14:52", maghrib: "17:49", isya: "18:59" };
    const t = prayerTimes("2026-10-26", jakarta);
    for (const [name, at] of Object.entries(expected) as [PrayerName, string][]) {
      expect(Math.abs(minutes(hhmm(t[name])) - minutes(at)), name).toBeLessThanOrEqual(1);
    }
  });

  it("finds the break in progress and the next one", () => {
    const t = prayerTimes("2026-10-20", jakarta);
    expect(currentPrayerBreak(t.ashar + 5 * 60_000, jakarta, 15)).toMatchObject({ name: "ashar", jumat: false });
    expect(currentPrayerBreak(t.ashar + 16 * 60_000, jakarta, 15)).toBeNull();
    expect(nextPrayerBreak(t.ashar + 16 * 60_000, jakarta, 15).name).toBe("maghrib");
    // After Isya the next break is tomorrow's Subuh.
    expect(nextPrayerBreak(t.isya + 60 * 60_000, jakarta, 15).name).toBe("subuh");
  });

  it("gives Friday Dzuhur (Jumat) a longer break", () => {
    const friday = prayerTimes("2026-10-23", jakarta);
    const b = currentPrayerBreak(friday.dzuhur + 30 * 60_000, jakarta, 15);
    expect(b).toMatchObject({ name: "dzuhur", jumat: true });
  });
});
