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

function localParts(market: Market, now: Date) {
  const { tz } = SESSIONS[market];
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

export function marketStatus(market: Market, now = new Date()) {
  const { tz, sessions } = SESSIONS[market];
  const { day, minutes } = localParts(market, now);
  if (day === 0 || day === 6) return { open: false, label: "Tutup (akhir pekan)", tz };
  const list = sessions(day);
  const inSession = list.findIndex(([a, b]) => minutes >= a && minutes < b);
  if (inSession >= 0) return { open: true, label: market === "IDX" ? `Sesi ${inSession + 1}` : "Regular session", tz };
  if (minutes < list[0][0]) return { open: false, label: "Pra-pembukaan", tz };
  if (list.length > 1 && minutes >= list[0][1] && minutes < list[1][0]) return { open: false, label: "Istirahat", tz };
  return { open: false, label: "Tutup", tz };
}

export interface EntryWindow {
  /** Exchange-local date of `now` (`YYYY-MM-DD`). */
  today: string;
  /** Today is a weekday and its last session has not ended (open, pre-open or break). */
  sessionAhead: boolean;
  /** Next weekday after today (`YYYY-MM-DD`). Exchange holidays are not modelled. */
  nextDay: string;
  label: string;
}

/** Which trading day an entry decided now can still be executed on. */
export function entryWindow(market: Market, now = new Date()): EntryWindow {
  const { day, minutes, ymd } = localParts(market, now);
  const weekday = day >= 1 && day <= 5;
  const list = weekday ? SESSIONS[market].sessions(day) : [];
  const sessionAhead = weekday && minutes < list[list.length - 1][1];
  const [y, m, d] = ymd.split("-").map(Number);
  let next = Date.UTC(y, m - 1, d + 1);
  while ([0, 6].includes(new Date(next).getUTCDay())) next += 86_400_000;
  return { today: ymd, sessionAhead, nextDay: new Date(next).toISOString().slice(0, 10), label: marketStatus(market, now).label };
}

/** `YYYY-MM-DD` → "Rabu, 21 Okt". */
export function formatTradingDay(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", weekday: "long", day: "numeric", month: "short" }).format(Date.UTC(y, m - 1, d));
}
