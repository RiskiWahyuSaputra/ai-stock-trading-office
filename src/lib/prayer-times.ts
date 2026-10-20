/**
 * Five daily prayer times, computed astronomically with the Kemenag RI
 * convention: Subuh at sun −20°, Isya at −18°, Ashar when a shadow equals
 * its object plus the noon shadow (Syafi'i), plus 2 minutes ihtiyat.
 * Accurate to about a minute; local announcements may differ slightly.
 */

export interface PrayerCity {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tz: string;
}

export const PRAYER_CITIES: PrayerCity[] = [
  { id: "jakarta", name: "Jakarta", lat: -6.2088, lng: 106.8456, tz: "Asia/Jakarta" },
  { id: "bandung", name: "Bandung", lat: -6.9175, lng: 107.6191, tz: "Asia/Jakarta" },
  { id: "semarang", name: "Semarang", lat: -6.9667, lng: 110.4167, tz: "Asia/Jakarta" },
  { id: "yogyakarta", name: "Yogyakarta", lat: -7.7956, lng: 110.3695, tz: "Asia/Jakarta" },
  { id: "surabaya", name: "Surabaya", lat: -7.2575, lng: 112.7521, tz: "Asia/Jakarta" },
  { id: "medan", name: "Medan", lat: 3.5952, lng: 98.6722, tz: "Asia/Jakarta" },
  { id: "padang", name: "Padang", lat: -0.9471, lng: 100.4172, tz: "Asia/Jakarta" },
  { id: "pekanbaru", name: "Pekanbaru", lat: 0.5071, lng: 101.4478, tz: "Asia/Jakarta" },
  { id: "palembang", name: "Palembang", lat: -2.9761, lng: 104.7754, tz: "Asia/Jakarta" },
  { id: "pontianak", name: "Pontianak", lat: -0.0263, lng: 109.3425, tz: "Asia/Pontianak" },
  { id: "banjarmasin", name: "Banjarmasin", lat: -3.3194, lng: 114.5908, tz: "Asia/Makassar" },
  { id: "balikpapan", name: "Balikpapan", lat: -1.2379, lng: 116.8529, tz: "Asia/Makassar" },
  { id: "denpasar", name: "Denpasar", lat: -8.6705, lng: 115.2126, tz: "Asia/Makassar" },
  { id: "makassar", name: "Makassar", lat: -5.1477, lng: 119.4327, tz: "Asia/Makassar" },
  { id: "manado", name: "Manado", lat: 1.4748, lng: 124.8421, tz: "Asia/Makassar" },
  { id: "ambon", name: "Ambon", lat: -3.6954, lng: 128.1814, tz: "Asia/Jayapura" },
  { id: "jayapura", name: "Jayapura", lat: -2.5337, lng: 140.7181, tz: "Asia/Jayapura" },
];

export type PrayerName = "subuh" | "dzuhur" | "ashar" | "maghrib" | "isya";

export const PRAYER_LABEL: Record<PrayerName, string> = {
  subuh: "Subuh",
  dzuhur: "Dzuhur",
  ashar: "Ashar",
  maghrib: "Maghrib",
  isya: "Isya",
};

export const RAKAAT: Record<PrayerName, number> = { subuh: 2, dzuhur: 4, ashar: 4, maghrib: 3, isya: 4 };

const IHTIYAT_MIN = 2;
const FAJR_ANGLE = 20;
const ISHA_ANGLE = 18;
/** Sunset: upper limb at the horizon incl. refraction. */
const SUNSET_ANGLE = 0.833;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Sun declination (deg) and equation of time (hours) for a Julian day. */
function sun(jd: number) {
  const d = jd - 2451545.0;
  const g = rad((357.529 + 0.98560028 * d) % 360);
  const q = (280.459 + 0.98564736 * d) % 360;
  const L = rad((q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) % 360);
  const e = rad(23.439 - 0.00000036 * d);
  const RA = deg(Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L))) / 15;
  const decl = deg(Math.asin(Math.sin(e) * Math.sin(L)));
  let eqt = q / 15 - ((RA + 24) % 24);
  eqt = ((eqt + 12) % 24 + 24) % 24 - 12;
  return { decl, eqt };
}

/** UTC offset (hours) of `tz` at instant `ms`. */
function offsetHours(tz: string, ms: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(ms);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((local - Math.floor(ms / 60_000) * 60_000) / 60_000) / 60;
}

/** Local `YYYY-MM-DD` of `ms` in `tz`. */
export function localDate(tz: string, ms: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
}

/** Prayer times for a local date in a city, as epoch milliseconds. */
export function prayerTimes(ymd: string, city: PrayerCity): Record<PrayerName, number> {
  const [y, m, d] = ymd.split("-").map(Number);
  const midnightUtc = Date.UTC(y, m - 1, d);
  const tz = offsetHours(city.tz, midnightUtc + 12 * 3_600_000);
  const jd = midnightUtc / 86_400_000 + 2440587.5 - city.lng / 360;

  /** Local clock hour at which the sun is `angle` below the horizon (hour angle method). */
  const at = (hour: number, angle: (decl: number) => number, dir: 1 | -1) => {
    const { decl, eqt } = sun(jd + hour / 24);
    const noon = 12 + tz - city.lng / 15 - eqt;
    const a = angle(decl);
    const cos = (-Math.sin(rad(a)) - Math.sin(rad(city.lat)) * Math.sin(rad(decl))) / (Math.cos(rad(city.lat)) * Math.cos(rad(decl)));
    return noon + (dir * deg(Math.acos(Math.max(-1, Math.min(1, cos))))) / 15;
  };
  const asrAngle = (decl: number) => -deg(Math.atan(1 / (1 + Math.tan(rad(Math.abs(city.lat - decl))))));

  // Two passes: evaluate the sun at the approximate time of each prayer.
  const first = { subuh: 5, dzuhur: 12, ashar: 15, maghrib: 18, isya: 19 };
  const calc = (h: typeof first) => ({
    subuh: at(h.subuh, () => FAJR_ANGLE, -1),
    dzuhur: (() => {
      const { eqt } = sun(jd + h.dzuhur / 24);
      return 12 + tz - city.lng / 15 - eqt;
    })(),
    ashar: at(h.ashar, asrAngle, 1),
    maghrib: at(h.maghrib, () => SUNSET_ANGLE, 1),
    isya: at(h.isya, () => ISHA_ANGLE, 1),
  });
  const hours = calc(calc(first));

  // Kemenag rounds every time up to the next whole minute.
  const toMs = (h: number) => midnightUtc + Math.ceil((h - tz) * 60 + IHTIYAT_MIN) * 60_000;
  return {
    subuh: toMs(hours.subuh),
    dzuhur: toMs(hours.dzuhur),
    ashar: toMs(hours.ashar),
    maghrib: toMs(hours.maghrib),
    isya: toMs(hours.isya),
  };
}

export interface PrayerBreak {
  name: PrayerName;
  /** Friday Dzuhur is Sholat Jumat (longer break). */
  jumat: boolean;
  rakaat: number;
  start: number;
  end: number;
}

/** Friday Dzuhur break: khutbah + sholat Jumat. */
export const JUMAT_MINUTES = 45;

/** The break in progress at `now`, if any. */
export function currentPrayerBreak(now: number, city: PrayerCity, minutes: number): PrayerBreak | null {
  for (const b of breaksAround(now, city, minutes)) if (now >= b.start && now < b.end) return b;
  return null;
}

/** The next break that starts after `now`. */
export function nextPrayerBreak(now: number, city: PrayerCity, minutes: number): PrayerBreak {
  return breaksAround(now, city, minutes).find((b) => b.start > now)!;
}

function breaksAround(now: number, city: PrayerCity, minutes: number): PrayerBreak[] {
  const days = [-1, 0, 1].map((k) => localDate(city.tz, now + k * 86_400_000));
  return days.flatMap((ymd) => {
    const times = prayerTimes(ymd, city);
    const [y, m, d] = ymd.split("-").map(Number);
    const friday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 5;
    return (Object.keys(times) as PrayerName[]).map((name) => {
      const jumat = friday && name === "dzuhur";
      return {
        name,
        jumat,
        rakaat: jumat ? 2 : RAKAAT[name],
        start: times[name],
        end: times[name] + (jumat ? JUMAT_MINUTES : minutes) * 60_000,
      };
    });
  });
}

export function prayerTitle(b: Pick<PrayerBreak, "name" | "jumat">) {
  return b.jumat ? "Sholat Jumat" : `Sholat ${PRAYER_LABEL[b.name]}`;
}
