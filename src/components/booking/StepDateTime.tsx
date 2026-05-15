"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { buildMonthGrid, isAvailable, sameDay } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import type { Service } from "@/types/service";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS_SHORT = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const TIME_SLOTS = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

type Props = {
  service: Service;
  date: string | null;
  time: string | null;
  onChange: (next: { date: string | null; time: string | null }) => void;
};

export function StepDateTime({ date, time, onChange }: Props) {
  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [anchor, setAnchor] = React.useState<Date>(() => {
    if (date) return new Date(date);
    return today;
  });

  const cells = React.useMemo(() => buildMonthGrid(anchor), [anchor]);
  const selectedDate = date ? new Date(date) : null;

  const go = (months: number) => {
    const next = new Date(anchor);
    next.setDate(1);
    next.setMonth(next.getMonth() + months);
    setAnchor(next);
  };

  const pickDate = (d: Date) => {
    if (d < today || !isAvailable(d)) return;
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    onChange({ date: iso, time });
  };

  const pickTime = (t: string) => {
    if (!date) return;
    onChange({ date, time: t });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] items-start">
      <Card padded={false}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft">
          <button
            type="button"
            onClick={() => go(-1)}
            className="w-8 h-8 rounded-md hover:bg-paper-2 text-ink-3 flex items-center justify-center"
            aria-label="Previous month"
          >
            <Icon name="chevron-l" size={16} />
          </button>
          <div className="font-serif text-ink" style={{ fontSize: 17 }}>
            {MONTH_NAMES[anchor.getMonth()]} {anchor.getFullYear()}
          </div>
          <button
            type="button"
            onClick={() => go(1)}
            className="w-8 h-8 rounded-md hover:bg-paper-2 text-ink-3 flex items-center justify-center"
            aria-label="Next month"
          >
            <Icon name="chevron-r" size={16} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 px-4 pt-3">
          {DAYS_SHORT.map((d) => (
            <div key={d} className="text-center text-micro py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 px-4 pb-4">
          {cells.map((c) => {
            const past = c.date < today;
            const avail = isAvailable(c.date);
            const selected = !!selectedDate && sameDay(c.date, selectedDate);
            const disabled = past || !avail || !c.inMonth;
            return (
              <button
                key={c.iso}
                type="button"
                onClick={() => pickDate(c.date)}
                disabled={disabled}
                className={cn(
                  "relative flex flex-col items-center justify-center h-12 rounded-md text-[14px] transition-colors",
                  c.inMonth ? "text-ink" : "text-ink-4",
                  selected && "bg-accent text-white",
                  !selected && !disabled && "hover:bg-paper-2",
                  disabled && "opacity-40 cursor-not-allowed",
                )}
              >
                <span>{c.date.getDate()}</span>
                {avail && c.inMonth && !past && !selected && (
                  <span
                    className="absolute bottom-1.5 rounded-full bg-accent"
                    style={{ width: 7, height: 7 }}
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <Card padded>
        <div className="eyebrow mb-3">Available times</div>
        {!date ? (
          <p className="text-small">Pick a date to see available times.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {TIME_SLOTS.map((t) => {
              const active = time === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => pickTime(t)}
                  className={cn(
                    "h-11 rounded-md border text-[14px] font-medium transition-colors",
                    active
                      ? "bg-accent text-white border-accent"
                      : "bg-surface text-ink border-line hover:border-ink-3",
                  )}
                >
                  {t}
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
