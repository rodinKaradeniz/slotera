"use client";

import * as React from "react";
import { sameDay } from "@/lib/calendar";
import { EventBlock, type CalEvent } from "./EventBlock";
import { cn } from "@/lib/cn";

type Props = {
  anchor: Date;
  events: CalEvent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 08–18
const HOUR_PX = 64;

export function DayGrid({ anchor, events, selectedId, onSelect }: Props) {
  const dayEvents = events.filter((e) =>
    sameDay(new Date(e.session.startISO), anchor),
  );
  const today = sameDay(anchor, new Date());

  return (
    <div className="bg-surface border border-line rounded-lg shadow-1 overflow-hidden">
      <div className="grid grid-cols-[60px_1fr] border-b border-line-soft">
        <div className="bg-surface-warm" />
        <div
          className={cn(
            "px-3 py-2 text-center border-l border-line-soft",
            today ? "bg-accent-soft" : "bg-surface-warm",
          )}
        >
          <div className="text-micro">
            {anchor.toLocaleDateString(undefined, { weekday: "short" })}
          </div>
          <div className={cn("font-serif text-[20px]", today && "text-accent-ink")}>
            {anchor.getDate()}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-[60px_1fr] relative" style={{ height: HOUR_PX * HOURS.length }}>
        <div className="border-r border-line-soft">
          {HOURS.map((h) => (
            <div
              key={h}
              className="px-2 pt-1 text-micro text-ink-3 border-b border-line-soft last:border-b-0"
              style={{ height: HOUR_PX }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        <div className="relative">
          {HOURS.map((h) => (
            <div
              key={h}
              className="border-b border-line-soft last:border-b-0"
              style={{ height: HOUR_PX }}
            />
          ))}
          {dayEvents.map((e) => (
            <EventBlock
              key={e.session.id}
              event={e}
              selected={e.session.id === selectedId}
              hourPx={HOUR_PX}
              onSelect={() =>
                onSelect(e.session.id === selectedId ? null : e.session.id)
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
