"use client";

import * as React from "react";
import { buildWeekDays, sameDay } from "@/lib/calendar";
import { EventBlock, type CalEvent } from "./EventBlock";
import { cn } from "@/lib/cn";

type Props = {
  anchor: Date;
  events: CalEvent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 08–18

export function WeekGrid({ anchor, events, selectedId, onSelect }: Props) {
  const days = buildWeekDays(anchor);

  const eventsByDayIndex = React.useMemo(() => {
    const map: CalEvent[][] = Array.from({ length: 7 }, () => []);
    for (const e of events) {
      const start = new Date(e.session.startISO);
      for (let i = 0; i < 7; i++) {
        if (sameDay(start, days[i])) {
          map[i].push(e);
          break;
        }
      }
    }
    return map;
  }, [events, days]);

  return (
    <div className="bg-surface border border-line rounded-lg shadow-1 overflow-hidden">
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-line-soft">
        <div className="bg-surface-warm" />
        {days.map((d, i) => {
          const today = sameDay(d, new Date());
          return (
            <div
              key={i}
              className={cn(
                "px-3 py-2 text-center border-l border-line-soft",
                today ? "bg-accent-soft" : "bg-surface-warm",
              )}
            >
              <div className="text-micro">
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </div>
              <div className={cn("font-serif text-[20px]", today && "text-accent-ink")}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-[60px_repeat(7,1fr)] relative" style={{ height: 56 * 11 }}>
        <div className="border-r border-line-soft">
          {HOURS.map((h) => (
            <div
              key={h}
              className="h-14 px-2 pt-1 text-micro text-ink-3 border-b border-line-soft last:border-b-0"
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {days.map((_, dayIdx) => (
          <div key={dayIdx} className="relative border-r border-line-soft last:border-r-0">
            {HOURS.map((h) => (
              <div key={h} className="h-14 border-b border-line-soft last:border-b-0" />
            ))}
            {eventsByDayIndex[dayIdx].map((e) => (
              <EventBlock
                key={e.session.id}
                event={e}
                selected={e.session.id === selectedId}
                onSelect={() =>
                  onSelect(e.session.id === selectedId ? null : e.session.id)
                }
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
