"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { SegGroup } from "@/components/ui/SegGroup";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { plural } from "@/lib/text";
import { useLoad } from "@/lib/use-load";
import { LoadError } from "@/components/shared/LoadError";
import { WeekGrid } from "./WeekGrid";
import { DayGrid } from "./DayGrid";
import { MonthGrid } from "./MonthGrid";
import { listSessions } from "@/services/sessions.service";
import { listServices } from "@/services/services.service";
import { listBookings } from "@/services/bookings.service";
import { listClients } from "@/services/clients.service";
import { useDrawers } from "@/components/drawers/DrawersProvider";
import { buildWeekDays, sameDay } from "@/lib/calendar";
import { dataSource } from "@/lib/env";
import type { Booking } from "@/types/booking";
import type { Client } from "@/types/client";
import type { CalEvent } from "./EventBlock";

type CalView = "day" | "week" | "month";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function titleFor(view: CalView, anchor: Date): string {
  if (view === "day") {
    return anchor.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  if (view === "week") {
    const [first, ...rest] = buildWeekDays(anchor);
    const last = rest[rest.length - 1];
    const sameMonth = first.getMonth() === last.getMonth();
    const sameYear = first.getFullYear() === last.getFullYear();
    const month = MONTH_NAMES[last.getMonth()];
    if (sameMonth) {
      return `Week of ${first.getDate()} – ${last.getDate()} ${month} ${last.getFullYear()}`;
    }
    if (sameYear) {
      return `Week of ${first.getDate()} ${MONTH_NAMES[first.getMonth()]} – ${last.getDate()} ${month} ${last.getFullYear()}`;
    }
    return `Week of ${first.getDate()} ${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()} – ${last.getDate()} ${month} ${last.getFullYear()}`;
  }
  return `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;
}

function shift(view: CalView, anchor: Date, delta: number): Date {
  const next = new Date(anchor);
  if (view === "day") next.setDate(next.getDate() + delta);
  else if (view === "week") next.setDate(next.getDate() + delta * 7);
  else next.setMonth(next.getMonth() + delta);
  return next;
}

const NONE: never[] = [];

/** The real app's calendar only needs sessions and services; the demo also shows client names. */
async function loadCalendar() {
  if (dataSource === "api") {
    const [sessions, services] = await Promise.all([listSessions(), listServices()]);
    return { sessions, services, bookings: [] as Booking[], clients: [] as Client[] };
  }
  const [sessions, services, bookings, clients] = await Promise.all([
    listSessions(),
    listServices(),
    listBookings(),
    listClients(),
  ]);
  return { sessions, services, bookings, clients };
}

export function CalendarView() {
  const { openSessionDrawer } = useDrawers();
  const [anchor, setAnchor] = React.useState(() =>
    dataSource === "api" ? new Date() : new Date(2026, 4, 11),
  );
  const [view, setView] = React.useState<CalView>("week");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const { data, error, reload } = useLoad(loadCalendar);
  const sessions = data?.sessions ?? NONE;
  const services = data?.services ?? NONE;
  const bookings = data?.bookings ?? NONE;
  const clients = data?.clients ?? NONE;

  const clientById = React.useMemo(() => {
    const m = new Map<string, Client>();
    for (const c of clients) m.set(c.id, c);
    return m;
  }, [clients]);

  const clientNameBySession = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const b of bookings) {
      if (m.has(b.sessionId)) continue;
      const c = clientById.get(b.clientId);
      if (c) m.set(b.sessionId, c.name);
    }
    return m;
  }, [bookings, clientById]);

  const events: CalEvent[] = sessions.map((s) => {
    const start = new Date(s.startISO);
    const end = new Date(s.endISO);
    return {
      session: s,
      service: services.find((sv) => sv.id === s.serviceId),
      clientName: clientNameBySession.get(s.id),
      startHour: start.getUTCHours() + start.getUTCMinutes() / 60,
      endHour: end.getUTCHours() + end.getUTCMinutes() / 60,
    };
  });

  const todayEvents = events.filter((e) =>
    sameDay(new Date(e.session.startISO), anchor),
  );
  const weekDays = buildWeekDays(anchor);
  const visibleWeekEvents = events.filter((e) =>
    weekDays.some((d) => sameDay(d, new Date(e.session.startISO))),
  );
  const monthEvents = events.filter((e) => {
    const d = new Date(e.session.startISO);
    return d.getMonth() === anchor.getMonth() && d.getFullYear() === anchor.getFullYear();
  });

  const summaryCount =
    view === "day"
      ? todayEvents.length
      : view === "week"
        ? visibleWeekEvents.length
        : monthEvents.length;
  const spotsOpen = (view === "day"
    ? todayEvents
    : view === "week"
      ? visibleWeekEvents
      : monthEvents
  ).reduce((acc, e) => acc + (e.session.capacity - e.session.bookedCount), 0);

  const openSessionFor = (id: string, mode: "view" | "edit" = "view") => {
    const ev = events.find((e) => e.session.id === id);
    if (!ev) return;
    setSelectedId(id);
    openSessionDrawer({
      initial: ev.session,
      mode,
      onSaved: reload,
      onCancelled: () => {
        setSelectedId(null);
        reload();
      },
    });
  };

  const meta = `${plural(summaryCount, "session")} · ${plural(spotsOpen, "spot")} open`;
  const description =
    view === "day"
      ? "Everything happening on this day at a glance."
      : view === "week"
        ? "Manage availability and bookings across the week."
        : "Plan ahead across the month, with a chip per session.";

  return (
    <PageContainer width="wide">
      <PageHeader
        eyebrow="Schedule"
        title={titleFor(view, anchor)}
        description={description}
        meta={meta}
        spacing="tight"
        actions={
          <>
            <div className="flex items-center bg-surface border border-line rounded-md">
              <button
                type="button"
                onClick={() => setAnchor(shift(view, anchor, -1))}
                className="w-9 h-9 hover:bg-paper-2 text-ink-2 flex items-center justify-center"
                aria-label={`Previous ${view}`}
              >
                <Icon name="chevron-l" size={16} />
              </button>
              <button
                type="button"
                onClick={() => setAnchor(new Date())}
                className="px-3 h-9 text-[13px] hover:bg-paper-2 border-x border-line"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setAnchor(shift(view, anchor, 1))}
                className="w-9 h-9 hover:bg-paper-2 text-ink-2 flex items-center justify-center"
                aria-label={`Next ${view}`}
              >
                <Icon name="chevron-r" size={16} />
              </button>
            </div>
            <SegGroup<CalView>
              value={view}
              onChange={setView}
              options={[
                { value: "day", label: "Day" },
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
              ]}
              size="md"
            />
            <Button
              variant="primary"
              size="md"
              icon="plus"
              onClick={() =>
                openSessionDrawer({
                  onSaved: reload,
                })
              }
            >
              New session
            </Button>
          </>
        }
      />
      <div className="mb-6" />

      {error && <LoadError message={error} onRetry={reload} />}
      {view === "day" && (
        <DayGrid
          anchor={anchor}
          events={events}
          selectedId={selectedId}
          onSelect={(id) => (id ? openSessionFor(id) : setSelectedId(null))}
        />
      )}
      {view === "week" && (
        <WeekGrid
          anchor={anchor}
          events={visibleWeekEvents}
          selectedId={selectedId}
          onSelect={(id) => (id ? openSessionFor(id) : setSelectedId(null))}
        />
      )}
      {view === "month" && (
        <MonthGrid
          anchor={anchor}
          events={monthEvents}
          onSelect={(id) => (id ? openSessionFor(id) : setSelectedId(null))}
        />
      )}
    </PageContainer>
  );
}
