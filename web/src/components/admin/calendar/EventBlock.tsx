"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import type { Service } from "@/types/service";
import type { SessionItem } from "@/types/session";

export type CalEvent = {
  session: SessionItem;
  service?: Service;
  clientName?: string;
  startHour: number;
  endHour: number;
};

type Props = {
  event: CalEvent;
  selected: boolean;
  onSelect: () => void;
  hourPx?: number;
};

const EVENT_STYLE = { bg: "#ECE8E0", fg: "#3B3B33" };

export function EventBlock({ event, selected, onSelect, hourPx = 56 }: Props) {
  const top = (event.startHour - 8) * hourPx;
  const height = Math.max(36, (event.endHour - event.startHour) * hourPx);
  const session = event.session;
  const dimmed = session.status === "cancelled" || session.status === "done";

  const secondary =
    session.capacity > 1
      ? `${session.bookedCount} / ${session.capacity} booked`
      : event.clientName;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "absolute left-1 right-1 rounded-md text-left p-2 transition-shadow",
        selected ? "shadow-2 ring-2 ring-accent" : "shadow-1 hover:shadow-2",
        dimmed && "opacity-60",
      )}
      style={{
        top,
        height,
        background: EVENT_STYLE.bg,
        color: EVENT_STYLE.fg,
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <div className="text-[13px] font-medium truncate leading-tight">
        {event.service?.name ?? "Session"}
      </div>
      {secondary && (
        <div className="text-[11px] opacity-80 truncate mt-0.5">{secondary}</div>
      )}
    </button>
  );
}
