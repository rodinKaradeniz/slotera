"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { SERVICE_STYLE } from "@/lib/status-maps";
import type { Service } from "@/types/service";
import type { SessionItem } from "@/types/session";

export type CalEvent = {
  session: SessionItem;
  service?: Service;
  startHour: number;
  endHour: number;
};

type Props = {
  event: CalEvent;
  selected: boolean;
  onSelect: () => void;
};

export function EventBlock({ event, selected, onSelect }: Props) {
  const style = event.service
    ? SERVICE_STYLE[event.service.kind]
    : { bg: "#ECE8E0", fg: "#3B3B33", label: "Session" };
  const top = (event.startHour - 8) * 56;
  const height = Math.max(36, (event.endHour - event.startHour) * 56);
  const session = event.session;
  const dimmed = session.status === "cancelled" || session.status === "done";
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
        background: style.bg,
        color: style.fg,
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <div className="text-[11px] font-mono">
        {session.startISO.slice(11, 16)} – {session.endISO.slice(11, 16)}
      </div>
      <div className="text-[13px] font-medium truncate mt-0.5">
        {event.service?.name ?? "Session"}
      </div>
      {session.capacity > 1 && (
        <div className="text-[11px] opacity-80 truncate">
          {session.bookedCount} / {session.capacity}
        </div>
      )}
    </button>
  );
}
