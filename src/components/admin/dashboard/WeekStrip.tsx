import * as React from "react";
import { Card } from "@/components/ui/Card";
import { CardHead } from "@/components/shared/CardHead";
import { SERVICE_STYLE } from "@/lib/status-maps";
import type { WeekDay } from "@/types/dashboard";
import { cn } from "@/lib/cn";

type Props = { days: WeekDay[] };

export function WeekStrip({ days }: Props) {
  return (
    <Card padded={false}>
      <CardHead title="This week" />
      <div className="grid grid-cols-7 gap-px bg-line-soft">
        {days.map((d) => (
          <div
            key={d.day}
            className={cn(
              "bg-surface px-3 py-3 flex flex-col gap-2 min-h-[120px]",
              d.today && "bg-accent-soft",
            )}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-micro">{d.day}</span>
              <span
                className={cn(
                  "text-[14px] font-medium",
                  d.today ? "text-accent-ink" : "text-ink",
                )}
              >
                {d.date}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {d.bookings.map((b, i) => {
                const s = SERVICE_STYLE[b.kind];
                return (
                  <span
                    key={i}
                    className="px-2 py-1 rounded-sm text-[11px] truncate"
                    style={{ background: s.bg, color: s.fg }}
                  >
                    {b.label}
                  </span>
                );
              })}
              {d.bookings.length === 0 && (
                <span className="text-micro text-ink-4">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
