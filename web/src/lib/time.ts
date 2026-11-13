import { readLang, localeForLang } from "@/lib/i18n";
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_NAMES_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));
const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function parseTime(hhmm: string): { h: number; m: number } {
  const [h, m] = hhmm.split(":").map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

export function fmtTime(hhmm: string): string {
  return hhmm;
}

export function addMinutes(hhmm: string, minutes: number): string {
  const { h, m } = parseTime(hhmm);
  const total = h * 60 + m + minutes;
  const nh = Math.floor((total + 24 * 60) / 60) % 24;
  const nm = ((total % 60) + 60) % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

export function fmtDate(d: Date, format: "short" | "long" = "long"): string {
  const lang = readLang();
  if (lang !== "en") return new Intl.DateTimeFormat(localeForLang(lang), { day: "numeric", month: format === "long" ? "long" : "short", year: "numeric" }).format(d);
  if (format === "long") {
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }
  return `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtDayShort(d: Date): string {
  const lang = readLang();
  return lang === "en" ? DAY_NAMES_SHORT[d.getDay()] : new Intl.DateTimeFormat(localeForLang(lang), { weekday: "short" }).format(d);
}

export function fmtWeekday(d: Date): string {
  const lang = readLang();
  if (lang !== "en") return new Intl.DateTimeFormat(localeForLang(lang), { weekday: "long" }).format(d);
  return [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][d.getDay()];
}

export function fmtRelative(targetISO: string, now: Date = new Date()): string {
  const target = new Date(targetISO);
  const lang = readLang();
  if (lang !== "en") {
    const minutes = (target.getTime() - now.getTime()) / 60000;
    const unit = Math.abs(minutes) < 60 ? "minute" : Math.abs(minutes) < 1440 ? "hour" : "day";
    const value = Math.round(minutes / (unit === "day" ? 1440 : unit === "hour" ? 60 : 1));
    return new Intl.RelativeTimeFormat(localeForLang(lang), { numeric: "auto", style: "short" }).format(value, unit);
  }
  const diffMs = target.getTime() - now.getTime();
  const absMin = Math.round(Math.abs(diffMs) / 60_000);
  const sign = diffMs >= 0 ? "in" : "ago";
  if (absMin < 60) return sign === "in" ? `in ${absMin}m` : `${absMin}m ago`;
  const h = Math.floor(absMin / 60);
  const m = absMin % 60;
  if (h < 24) {
    const text = m ? `${h}h ${m}m` : `${h}h`;
    return sign === "in" ? `in ${text}` : `${text} ago`;
  }
  const d = Math.floor(h / 24);
  return sign === "in" ? `in ${d}d` : `${d}d ago`;
}

export function fmtRange(startISO: string, endISO: string): string {
  const s = new Date(startISO);
  const e = new Date(endISO);
  const t = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(
      2,
      "0",
    )}`;
  return `${t(s)} – ${t(e)}`;
}

export function todayISO(): string {
  return new Date().toISOString();
}
