"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { cn } from "@/lib/cn";
import { useMinute } from "@/lib/use-minute";
import type { EventColumn } from "./event-columns";
import type { Service } from "@/types/service";
import type { SessionItem } from "@/types/session";

export type CalEvent = {
  dateKey: string;
  session: SessionItem;
  service?: Pick<Service, "name">;
  clientName?: string;
  startHour: number;
  endHour: number;
};

type Props = {
  event: CalEvent;
  selected: boolean;
  onSelect: () => void;
  hourPx?: number;
  column?: EventColumn;
};

export function EventBlock({ event, selected, onSelect, hourPx = 56, column = {index: 0, total: 1} }: Props) {
  const { t: uiText } = useI18n();
  const top = (event.startHour - 8) * hourPx;
  const height = Math.max(36, (event.endHour - event.startHour) * hourPx);
  const session = event.session;
  // Upcoming sessions carry the accent; past, done or cancelled ones step back.
  const now = useMinute();
  const past = session.status === "cancelled" || session.status === "done" || Date.parse(session.endISO) < now;

  const secondary =
    session.capacity > 1
      ? uiText("calendar.bookedCount", {count: session.bookedCount, capacity: session.capacity})
      : event.clientName;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${event.service?.name ?? uiText("ui.session")} · ${event.dateKey} · ${session.location}`}
      className={cn(
        "absolute left-1 right-1 rounded-md text-left p-2 border transition-shadow",
        past
          ? "bg-paper-2 text-ink-3 border-line-soft"
          : "bg-accent-soft text-accent-ink border-accent/20 border-l-[3px] border-l-accent",
        selected ? "shadow-2 ring-2 ring-accent" : past ? "" : "shadow-1 hover:shadow-2",
        session.status === "cancelled" && "line-through",
      )}
      style={{
        top,
        height,
        left: `calc(${column.index * 100 / column.total}% + 4px)`,
        right: "auto",
        width: `calc(${100 / column.total}% - 8px)`,
      }}
    >
      <div className="text-[13px] font-medium truncate leading-tight">
        {event.service?.name ?? uiText("ui.session")}
      </div>
      {secondary && (
        <div className="text-[11px] opacity-80 truncate mt-0.5">{secondary}</div>
      )}
    </button>
  );
}
