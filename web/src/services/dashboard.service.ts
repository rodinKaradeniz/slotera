import dashboardJson from "@/data/mock/dashboard.json";
import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { formatMoney } from "@/lib/money";
import { listBookings } from "./bookings.service";
import { listSessions } from "./sessions.service";
import { listActionItems } from "./session-action-items.service";
import type {
  DashboardData,
  DashboardScheduleItem,
  Kpi,
  PendingAction,
} from "@/types/dashboard";
import type { Booking } from "@/types/booking";
import type { Currency } from "@/types/common";
import type { SessionItem } from "@/types/session";
import type { SessionActionItem } from "@/types/session-action-item";
import { ApiRequestError } from "./_errors";

type DashboardSummaryDto = components["schemas"]["DashboardSummaryResponse"];
type DashboardSessionDto = components["schemas"]["DashboardSessionSummary"];

function dashboardCurrency(value: string): Currency {
  if ((["EUR", "USD", "GBP"] as string[]).includes(value)) return value as Currency;
  throw new ApiRequestError(
    200,
    "unsupported_currency",
    `The API returned unsupported currency ${value}.`,
  );
}

function timeInTimezone(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function duration(startAt: string, endAt: string): string {
  const minutes = Math.max(
    0,
    Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000),
  );
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

function mapSession(
  session: DashboardSessionDto,
  timezone: string,
  status: DashboardScheduleItem["status"],
): DashboardScheduleItem {
  return {
    id: session.id,
    bookingId: session.bookingId ?? undefined,
    time: timeInTimezone(session.startAt, timezone),
    end: timeInTimezone(session.endAt, timezone),
    client: session.clientName ?? "No booking yet",
    company: session.clientCompany ?? undefined,
    clientEmail: session.clientEmail ?? undefined,
    service: session.serviceName,
    duration: duration(session.startAt, session.endAt),
    status,
  };
}

function percentageChange(current: number, previous: number): {
  delta: string;
  trend: Kpi["trend"];
} {
  if (previous === 0) {
    return current === 0
      ? { delta: "No change", trend: "flat" }
      : { delta: "New this month", trend: "up" };
  }
  const percent = Math.round(((current - previous) / previous) * 100);
  return percent === 0
    ? { delta: "No change", trend: "flat" }
    : { delta: `${percent > 0 ? "+" : ""}${percent}%`, trend: percent > 0 ? "up" : "down" };
}

function mapSummary(summary: DashboardSummaryDto): DashboardData {
  const currency = dashboardCurrency(summary.currency);
  const revenueDelta = percentageChange(
    summary.revenueThisMonthCents,
    summary.revenuePreviousMonthCents,
  );
  const bookingsDelta = percentageChange(
    summary.bookingsThisMonth,
    summary.bookingsPreviousMonth,
  );
  const averageDelta = percentageChange(
    summary.averageBookingValueThisMonthCents,
    summary.averageBookingValuePreviousMonthCents,
  );
  const trend30d = summary.trend30d.map((point, index) => ({
    d: index + 1,
    revenue: point.revenueCents / 100,
    bookings: point.bookings,
  }));
  const currentTime = Date.now();
  const nextSession = summary.nextSession
    ? mapSession(summary.nextSession, summary.timezone, "next")
    : undefined;
  const todaySchedule = summary.todaySessions.map((session) =>
    mapSession(
      session,
      summary.timezone,
      nextSession?.id === session.id
        ? "next"
        : new Date(session.endAt).getTime() < currentTime
          ? "past"
          : "upcoming",
    ),
  );

  return {
    todayISO: `${summary.today}T00:00:00.000Z`,
    currency,
    timezone: summary.timezone,
    todaySchedule,
    nextSession,
    weekStrip: [],
    weekSessionCount: summary.weekSessionCount,
    kpis: [
      {
        id: "revenue",
        label: "Revenue this month",
        value: formatMoney(summary.revenueThisMonthCents, currency),
        ...revenueDelta,
        spark: trend30d.map((point) => point.revenue),
      },
      {
        id: "bookings",
        label: "Bookings this month",
        value: String(summary.bookingsThisMonth),
        ...bookingsDelta,
        spark: trend30d.map((point) => point.bookings),
      },
      {
        id: "average-value",
        label: "Average booking value",
        value: formatMoney(summary.averageBookingValueThisMonthCents, currency),
        ...averageDelta,
        spark: trend30d.map((point) =>
          point.bookings === 0 ? 0 : point.revenue / point.bookings,
        ),
      },
    ],
    trend30d,
    pendingActions: [
      ...(summary.openActionItemsCount > 0
        ? [{
            id: "action-items-pending",
            tone: "info" as const,
            icon: "clipboard",
            label: `Review ${summary.openActionItemsCount} open session action item${summary.openActionItemsCount === 1 ? "" : "s"}`,
            detail: "Open a session and use the Notes & Actions tab to work through them.",
            age: "now",
          }]
        : []),
      ...(summary.unreadNotificationsCount > 0
        ? [{
            id: "unread-notifications",
            tone: "info" as const,
            icon: "bell",
            label: `${summary.unreadNotificationsCount} unread notification${summary.unreadNotificationsCount === 1 ? "" : "s"}`,
            detail: "Review notifications for the latest workspace updates.",
            age: "now",
          }]
        : []),
    ],
    recentBookings: [],
  };
}

export async function getDashboard(): Promise<DashboardData> {
  if (dataSource === "api") {
    return mapSummary(await apiRequest<DashboardSummaryDto>("/dashboard/summary"));
  }
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
