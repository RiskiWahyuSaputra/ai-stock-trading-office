import type { Market } from "@/lib/domain/schemas";

/**
 * Regular trading sessions (local exchange time). Exchange holidays are NOT
 * modelled, so the status is labelled "jadwal reguler".
 */
const SESSIONS: Record<Market, { tz: string; sessions: (day: number) => [number, number][] }> = {
  IDX: {
    tz: "Asia/Jakarta",
    sessions: (day) =>
      day === 5
        ? [[9 * 60, 11 * 60 + 30], [14 * 60, 15 * 60 + 49]]
        : [[9 * 60, 12 * 60], [13 * 60 + 30, 15 * 60 + 49]],
  },
  US: { tz: "America/New_York", sessions: () => [[9 * 60 + 30, 16 * 60]] },
};

export function marketStatus(market: Market, now = new Date()) {
  const { tz, sessions } = SESSIONS[market];
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  if (day === 0 || day === 6) return { open: false, label: "Tutup (akhir pekan)", tz };
  const list = sessions(day);
  const inSession = list.findIndex(([a, b]) => minutes >= a && minutes < b);
  if (inSession >= 0) return { open: true, label: market === "IDX" ? `Sesi ${inSession + 1}` : "Regular session", tz };
  if (minutes < list[0][0]) return { open: false, label: "Pra-pembukaan", tz };
  if (list.length > 1 && minutes >= list[0][1] && minutes < list[1][0]) return { open: false, label: "Istirahat", tz };
  return { open: false, label: "Tutup", tz };
}
