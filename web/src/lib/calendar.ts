import type { SessionItem } from "@/types/session";

export type DayCell = {
  date: Date;
  iso: string;
  inMonth: boolean;
  isToday: boolean;
};

export function startOfWeek(d: Date, weekStartsOn: 0 | 1 = 1): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function buildWeekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor, 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function buildMonthGrid(anchor: Date): DayCell[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const start = startOfWeek(first, 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return {
      date,
      iso: date.toISOString(),
      inMonth: date.getMonth() === month,
      isToday: date.getTime() === today.getTime(),
    };
  });
}

export function isAvailable(date: Date): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  // pseudo-random: every weekday available except every 7th
  return date.getDate() % 7 !== 3;
}

export function sessionOverlaps(
  candidate: { startISO: string; endISO: string; id?: string },
  existing: Array<Pick<SessionItem, "id" | "startISO" | "endISO" | "status">>,
): SessionItem | null {
  const cs = new Date(candidate.startISO).getTime();
  const ce = new Date(candidate.endISO).getTime();
  for (const s of existing) {
    if (candidate.id && s.id === candidate.id) continue;
    if (s.status === "cancelled") continue;
    const es = new Date(s.startISO).getTime();
    const ee = new Date(s.endISO).getTime();
    if (cs < ee && ce > es) return s as SessionItem;
  }
  return null;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** `YYYY-MM-DD` for a calendar cell in the viewer's local time (the availability key). */
export function localDateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

/** A slot's date key and `HH:mm` in the workspace timezone, matching `localDateKey` cells. */
export function slotParts(startAt: string, timezone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(startAt));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`,
  };
}

/** `HH:mm` of an instant in the given timezone. */
export function clockIn(iso: string, timezone: string): string {
  return slotParts(iso, timezone).time;
}

/** The UTC ISO instant for a wall-clock `date` + `HH:mm` in the given timezone. */
export function zonedWallToISO(date: string, time: string, timezone: string): string {
  const wall = Date.parse(`${date}T${time}:00.000Z`);
  let guess = wall;
  for (let pass = 0; pass < 2; pass += 1) {
    const shown = slotParts(new Date(guess).toISOString(), timezone);
    guess += wall - Date.parse(`${shown.date}T${shown.time}:00.000Z`);
  }
  return new Date(guess).toISOString();
}

/** Calendar dates are wall dates in the workspace, independent of the browser zone. */
export function calendarDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

export function calendarSegments(startISO: string, endISO: string, timezone: string) {
  const start = slotParts(startISO, timezone);
  const end = slotParts(endISO, timezone);
  const hour = (time: string) => Number(time.slice(0,2)) + Number(time.slice(3,5))/60;
  const segments: {dateKey: string; startHour: number; endHour: number}[] = [];
  const day = new Date(`${start.date}T12:00:00Z`);
  for (let key = start.date; key <= end.date; key = day.toISOString().slice(0,10)) {
    const startHour = key === start.date ? hour(start.time) : 0;
    const endHour = key === end.date ? hour(end.time) : 24;
    if (endHour > startHour) segments.push({dateKey:key, startHour, endHour});
    day.setUTCDate(day.getUTCDate()+1);
  }
  return segments;
}
