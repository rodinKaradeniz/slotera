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
