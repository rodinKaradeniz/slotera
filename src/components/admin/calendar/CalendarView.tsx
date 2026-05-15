"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { WeekGrid } from "./WeekGrid";
import { DetailPanel } from "./DetailPanel";
import { listSessions } from "@/services/sessions.service";
import { listServices } from "@/services/services.service";
import { useDrawers } from "@/components/drawers/DrawersProvider";
import { buildWeekDays, sameDay } from "@/lib/calendar";
import { fmtDate } from "@/lib/time";
import type { SessionItem } from "@/types/session";
import type { Service } from "@/types/service";
import type { CalEvent } from "./EventBlock";

export function CalendarView() {
  const { openSessionDrawer } = useDrawers();
  const [anchor, setAnchor] = React.useState(() => new Date(2026, 4, 17)); // mid-May 2026 anchor
  const [sessions, setSessions] = React.useState<SessionItem[]>([]);
  const [services, setServices] = React.useState<Service[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    Promise.all([listSessions(), listServices()]).then(([s, sv]) => {
      setSessions(s);
      setServices(sv);
    });
  }, [reloadKey]);

  const days = buildWeekDays(anchor);
  const events: CalEvent[] = sessions.map((s) => {
    const start = new Date(s.startISO);
    const end = new Date(s.endISO);
    return {
      session: s,
      service: services.find((sv) => sv.id === s.serviceId),
      startHour: start.getUTCHours() + start.getUTCMinutes() / 60,
      endHour: end.getUTCHours() + end.getUTCMinutes() / 60,
    };
  });

  const visibleEvents = events.filter((e) =>
    days.some((d) => sameDay(d, new Date(e.session.startISO))),
  );

  const todayEvents = events.filter((e) =>
    sameDay(new Date(e.session.startISO), anchor),
  );
  const spotsOpen = todayEvents.reduce(
    (acc, e) => acc + (e.session.capacity - e.session.bookedCount),
    0,
  );

  const selected = events.find((e) => e.session.id === selectedId) ?? null;

  const go = (deltaDays: number) => {
    const next = new Date(anchor);
    next.setDate(anchor.getDate() + deltaDays);
    setAnchor(next);
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <div className="eyebrow mb-2">Calendar</div>
          <h1
            className="font-serif text-ink"
            style={{ fontSize: "clamp(28px, 3vw, 40px)", fontWeight: 380 }}
          >
            {fmtDate(anchor)}
          </h1>
          <p className="text-small mt-1">
            {todayEvents.length} sessions · {spotsOpen} spots open
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-surface border border-line rounded-md">
            <button
              type="button"
              onClick={() => go(-7)}
              className="w-9 h-9 hover:bg-paper-2 text-ink-2 flex items-center justify-center"
              aria-label="Previous week"
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
              onClick={() => go(7)}
              className="w-9 h-9 hover:bg-paper-2 text-ink-2 flex items-center justify-center"
              aria-label="Next week"
            >
              <Icon name="chevron-r" size={16} />
            </button>
          </div>
          <Button
            variant="primary"
            size="md"
            icon="plus"
            onClick={() =>
              openSessionDrawer({
                onSaved: () => setReloadKey((k) => k + 1),
              })
            }
          >
            New session
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-4 items-start">
        <WeekGrid
          anchor={anchor}
          events={visibleEvents}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        {selected && (
          <DetailPanel
            event={selected}
            onClose={() => setSelectedId(null)}
            onEdit={() =>
              openSessionDrawer({
                initial: selected.session,
                onSaved: () => setReloadKey((k) => k + 1),
                onCancelled: () => {
                  setSelectedId(null);
                  setReloadKey((k) => k + 1);
                },
              })
            }
          />
        )}
      </div>
    </div>
  );
}
