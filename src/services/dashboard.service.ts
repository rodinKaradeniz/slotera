import dashboardJson from "@/data/mock/dashboard.json";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { listBookings } from "./bookings.service";
import { listSessions } from "./sessions.service";
import type { DashboardData, PendingAction } from "@/types/dashboard";
import type { Booking } from "@/types/booking";
import type { SessionItem } from "@/types/session";
import { NotImplementedError } from "./_errors";

export async function getDashboard(): Promise<DashboardData> {
  if (dataSource !== "mock") throw new NotImplementedError("getDashboard");
  await sleep(80);
  const base = dashboardJson as unknown as DashboardData;
  // Live-derived pending actions get merged in front of the seeded ones so
  // recent operator activity (un-marked attendance, etc.) doesn't get buried.
  const [bookings, sessions] = await Promise.all([listBookings(), listSessions()]);
  const attendance = computeAttendancePending(bookings, sessions);
  return {
    ...base,
    pendingActions: attendance
      ? [attendance, ...base.pendingActions]
      : base.pendingActions,
  };
}

/**
 * Returns a PendingAction surfacing "record attendance for N group sessions"
 * when any past group session still has un-marked, non-cancelled bookings.
 * Returns null when nothing needs attention (the cleaner of two empty states).
 */
function computeAttendancePending(
  bookings: Booking[],
  sessions: SessionItem[],
): PendingAction | null {
  const now = Date.now();
  const candidateSessionIds = new Set<string>();
  for (const s of sessions) {
    if (s.capacity <= 1) continue;
    if (s.status === "cancelled") continue;
    if (new Date(s.startISO).getTime() >= now) continue;
    candidateSessionIds.add(s.id);
  }
  if (candidateSessionIds.size === 0) return null;

  const sessionsNeeding = new Set<string>();
  for (const b of bookings) {
    if (!candidateSessionIds.has(b.sessionId)) continue;
    if (b.status === "cancelled") continue;
    if (b.attendance) continue;
    sessionsNeeding.add(b.sessionId);
  }
  if (sessionsNeeding.size === 0) return null;

  const n = sessionsNeeding.size;
  return {
    id: "attendance-pending",
    tone: "info",
    icon: "users",
    label: `Record attendance for ${n} ${n === 1 ? "session" : "sessions"}`,
    detail: "Open the session and switch to the Attendance tab to mark attendees.",
    age: "now",
  };
}
