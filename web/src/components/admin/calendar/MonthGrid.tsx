"use client";

import * as React from "react";
import { buildMonthGrid, sameDay } from "@/lib/calendar";
import type { CalEvent } from "./EventBlock";
import { cn } from "@/lib/cn";

const EVENT_STYLE = { bg: "#ECE8E0", fg: "#3B3B33" };

type Props = {
  anchor: Date;
  events: CalEvent[];
  onSelect: (id: string | null) => void;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthGrid({ anchor, events, onSelect }: Props) {
  const cells = buildMonthGrid(anchor);
  const eventsByDay = new Map<string, CalEvent[]>();
  for (const e of events) {
    const d = new Date(e.session.startISO).toDateString();
    const list = eventsByDay.get(d) ?? [];
    list.push(e);
    eventsByDay.set(d, list);
  }

  return (
    <div className="bg-surface border border-line rounded-lg shadow-1 overflow-hidden">
      <div className="grid grid-cols-7 bg-surface-warm border-b border-line-soft">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-3 py-2 text-micro text-ink-3 text-center border-l border-line-soft first:border-l-0"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7" style={{ gridAutoRows: "minmax(112px, 1fr)" }}>
        {cells.map((c, i) => {
          const day = eventsByDay.get(c.date.toDateString()) ?? [];
          const inMonth = c.inMonth;
          const today = sameDay(c.date, new Date());
          return (
            <div
              key={i}
              className={cn(
                "border-l border-t border-line-soft p-2 flex flex-col gap-1 min-w-0",
                i % 7 === 0 && "border-l-0",
                !inMonth && "bg-paper-2/40",
              )}
            >
              <div
                className={cn(
                  "text-[12px] font-mono mb-1 self-end",
                  inMonth ? "text-ink-2" : "text-ink-4",
                  today && "text-accent font-semibold",
                )}
              >
                {c.date.getDate()}
              </div>
              {day.slice(0, 3).map((e) => {
                return (
                  <button
                    key={e.session.id}
                    type="button"
                    onClick={() => onSelect(e.session.id)}
                    className="text-left text-[11px] px-1.5 py-0.5 rounded truncate min-w-0"
                    style={{
                      background: EVENT_STYLE.bg,
                      color: EVENT_STYLE.fg,
                      border: "1px solid rgba(0,0,0,0.05)",
                    }}
                  >
                    <span className="font-mono opacity-70 mr-1">
                      {e.session.startISO.slice(11, 16)}
                    </span>
                    {e.service?.name ?? "Session"}
                  </button>
                );
              })}
              {day.length > 3 && (
                <div className="text-[10px] text-ink-3 pl-1">
                  +{day.length - 3} more
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
