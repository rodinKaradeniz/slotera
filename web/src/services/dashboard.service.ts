import { mockData } from "@/services/adapters/mock-data";
import { readLang, translate, type Lang , localeForLang} from "@/lib/i18n";

import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { formatMoney } from "@/lib/money";
import { listBookings } from "./bookings.service";
import { listSessions } from "./sessions.service";
import { listClients } from "./clients.service";
import { listServices } from "./services.service";
import { getAvailabilitySettings } from "./settings.service";
import { slotParts } from "@/lib/calendar";
import type {
  DashboardData,
  DashboardScheduleItem,
  Kpi,
} from "@/types/dashboard";
import { apiCurrency } from "./_currency";

type DashboardSummaryDto = components["schemas"]["DashboardSummaryResponse"];
type DashboardSessionDto = components["schemas"]["DashboardSessionSummary"];

function timeInTimezone(value: string, timezone: string): string {
  return new Intl.DateTimeFormat(localeForLang(readLang()), {
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
    startISO: session.startAt,
    timezone,
    time: timeInTimezone(session.startAt, timezone),
    end: timeInTimezone(session.endAt, timezone),
    client: session.clientName ?? translate(readLang(), "dashboard.noBooking"),
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
      ? { delta: "0%", trend: "flat" }
      : { delta: translate(readLang(), "dashboard.newMonth"), trend: "up" };
  }
  const percent = Math.round(((current - previous) / previous) * 100);
  return percent === 0
    ? { delta: "0%", trend: "flat" }
    : { delta: `${percent > 0 ? "+" : ""}${percent}%`, trend: percent > 0 ? "up" : "down" };
}

function mapSummary(summary: DashboardSummaryDto): DashboardData {
  const currency = apiCurrency(summary.currency);
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
        label: translate(readLang(), "dashboard.revenue"),
        value: formatMoney(summary.revenueThisMonthCents, currency),
        ...revenueDelta,
        spark: trend30d.map((point) => point.revenue),
      },
      {
        id: "bookings",
        label: translate(readLang(), "dashboard.bookings"),
        value: String(summary.bookingsThisMonth),
        ...bookingsDelta,
        spark: trend30d.map((point) => point.bookings),
      },
      {
        id: "clients",
        label: translate(readLang(), "dashboard.clients"),
        value: String(summary.clientsThisMonth),
        ...percentageChange(summary.clientsThisMonth, summary.clientsPreviousMonth),
        spark: [],
      },
      {
        id: "average-value",
        label: translate(readLang(), "dashboard.average"),
        value: formatMoney(summary.averageBookingValueThisMonthCents, currency),
        ...averageDelta,
        spark: trend30d.map((point) =>
          point.bookings === 0 ? 0 : point.revenue / point.bookings,
        ),
      },
    ],
    trend30d,
    recentBookings: [],
  };
}

export async function getDashboard(_lang: Lang = readLang()): Promise<DashboardData> {
  if (dataSource === "api") {
    const summary=await apiRequest<DashboardSummaryDto>("/dashboard/summary");
    return mapSummary(summary);
  }
  await sleep(80);
  // The demo builds the schedule like the API summary: from the (date-shifted) demo
  // sessions, their bookings and the workspace timezone, against the real clock.
  const base = mockData<Omit<DashboardData, "todaySchedule" | "weekStrip">>("dashboard");
  const [sessions, bookings, clients, services, availability] = await Promise.all([
    listSessions(), listBookings(), listClients(), listServices(), getAvailabilitySettings(),
  ]);
  const timezone = availability.timezone;
  const now = Date.now();
  const today = slotParts(new Date(now).toISOString(), timezone).date;
  const live = sessions
    .filter((session) => session.status !== "cancelled")
    .sort((a, b) => a.startISO.localeCompare(b.startISO));
  const toDto = (session: (typeof live)[number]): DashboardSessionDto => {
    const booking = bookings.find((item) => item.sessionId === session.id && item.status !== "cancelled");
    const client = clients.find((item) => item.id === booking?.clientId);
    return {
      id: session.id,
      bookingId: booking?.id ?? null,
      startAt: session.startISO,
      endAt: session.endISO,
      clientName: client?.name ?? null,
      clientCompany: client?.company ?? null,
      clientEmail: client?.email ?? null,
      serviceName: services.find((item) => item.id === session.serviceId)?.name ?? "",
    };
  };
  const upcoming = live.find((session) => Date.parse(session.endISO) > now);
  const nextSession = upcoming ? mapSession(toDto(upcoming), timezone, "next") : undefined;
  const todaySchedule = live
    .filter((session) => slotParts(session.startISO, timezone).date === today)
    .map((session) => mapSession(toDto(session), timezone,
      session.id === upcoming?.id ? "next" : Date.parse(session.endISO) < now ? "past" : "upcoming"));
  const weekStart = new Date(`${today}T00:00:00Z`);
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const weekSessionCount = live.filter((session) => {
    const day = slotParts(session.startISO, timezone).date;
    return day >= weekStart.toISOString().slice(0, 10) && day < weekEnd;
  }).length;
  return {
    ...base,
    todayISO: `${today}T00:00:00.000Z`,
    timezone,
    todaySchedule,
    nextSession,
    weekStrip: [],
    weekSessionCount,
    kpis: base.kpis.map((item) => ({
      ...item,
      label: translate(readLang(), item.id === "revenue" ? "dashboard.revenue"
        : item.id === "bookings" ? "dashboard.bookings"
        : item.id === "clients" ? "dashboard.clients" : "dashboard.average"),
    })),
  };
}

