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
  if (format === "long") {
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }
  return `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtDayShort(d: Date): string {
  return DAY_NAMES_SHORT[d.getDay()];
}

export function fmtWeekday(d: Date): string {
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
