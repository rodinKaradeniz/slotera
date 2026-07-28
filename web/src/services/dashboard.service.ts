import dashboardJson from "@/data/mock/dashboard.json";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { listBookings } from "./bookings.service";
import { listSessions } from "./sessions.service";
import { listActionItems } from "./session-action-items.service";
import type { DashboardData, PendingAction } from "@/types/dashboard";
import type { Booking } from "@/types/booking";
import type { SessionItem } from "@/types/session";
import type { SessionActionItem } from "@/types/session-action-item";
import { NotImplementedError } from "./_errors";

export async function getDashboard(): Promise<DashboardData> {
  if (dataSource !== "mock") throw new NotImplementedError("getDashboard");
  await sleep(80);
  const base = dashboardJson as unknown as DashboardData;
  // Live-derived pending actions get merged in front of the seeded ones so
  // recent operator activity (un-marked attendance, open tasks, etc.) doesn't
  // get buried.
  const [bookings, sessions, actionItems] = await Promise.all([
    listBookings(),
    listSessions(),
    listActionItems(),
  ]);
  const derived = [
    computeAttendancePending(bookings, sessions),
    computeActionItemsPending(actionItems, sessions),
  ].filter((a): a is PendingAction => a !== null);
  return {
    ...base,
    pendingActions: [...derived, ...base.pendingActions],
  };
}

/**
 * Surfaces "review N open session action items" when any real session has
 * `todo` action items. Demo-only sessions (not present in the sessions list,
 * e.g. the booking-workspace seed) are excluded.
 */
function computeActionItemsPending(
  actionItems: SessionActionItem[],
  sessions: SessionItem[],
): PendingAction | null {
  const sessionIds = new Set(sessions.map((s) => s.id));
  const open = actionItems.filter(
    (a) => a.status === "todo" && sessionIds.has(a.sessionId),
  );
  if (open.length === 0) return null;
  const n = open.length;
  return {
    id: "action-items-pending",
    tone: "info",
    icon: "clipboard",
    label: `Review ${n} open session action item${n === 1 ? "" : "s"}`,
    detail: "Open a session and use the Notes & Actions tab to work through them.",
    age: "now",
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
