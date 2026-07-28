"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Avatar } from "@/components/ui/Avatar";
import { CardHead } from "@/components/shared/CardHead";
import { useDrawers } from "@/components/drawers/DrawersProvider";
import { getBooking } from "@/services/bookings.service";
import type { DashboardScheduleItem } from "@/types/dashboard";
import type { Booking } from "@/types/booking";
import { cn } from "@/lib/cn";

const EVENT_STYLE = { bg: "#E7EDE3", fg: "#2A3F2A" };

type Props = {
  item?: DashboardScheduleItem;
  schedule: DashboardScheduleItem[];
};

const DAY_START = 8;
const DAY_END = 20;
const RAIL_HEIGHT = 14;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

function pct(v: number, min: number, max: number): number {
  return ((v - min) / (max - min)) * 100;
}

function totalBookedHours(items: DashboardScheduleItem[]): number {
  const mins = items.reduce(
    (acc, i) => acc + (toMinutes(i.end) - toMinutes(i.time)),
    0,
  );
  return Math.round((mins / 60) * 10) / 10;
}

type HoverInfo = { item: DashboardScheduleItem; x: number; y: number };

function ScheduleRail({
  items,
  onHover,
}: {
  items: DashboardScheduleItem[];
  onHover: (info: HoverInfo | null) => void;
}) {
  const startMin = DAY_START * 60;
  const endMin = DAY_END * 60;
  const ticks: number[] = [];
  for (let h = DAY_START; h <= DAY_END; h += 3) ticks.push(h);
  const railRef = React.useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const move = (e: React.MouseEvent, it: DashboardScheduleItem) => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect) return;
    onHover({ item: it, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div ref={railRef} className="select-none relative">
      <div className="relative" style={{ height: RAIL_HEIGHT + 8 }}>
        <div
          className="absolute left-0 right-0 h-px"
          style={{
            top: RAIL_HEIGHT / 2,
            background: "var(--line-soft)",
          }}
        />
        {items.map((it) => {
          const left = pct(toMinutes(it.time), startMin, endMin);
          const width = pct(toMinutes(it.end), startMin, endMin) - left;
          const style = EVENT_STYLE;
          const isActive = activeId === it.id;
          const isPast = it.status === "done" || it.status === "past";
          const h = isActive ? RAIL_HEIGHT : Math.round(RAIL_HEIGHT * 0.75);
          return (
            <button
              key={it.id}
              type="button"
              onMouseEnter={(e) => {
                setActiveId(it.id);
                move(e, it);
              }}
              onMouseMove={(e) => move(e, it)}
              onMouseLeave={() => {
                setActiveId(null);
                onHover(null);
              }}
              onFocus={(e) => {
                setActiveId(it.id);
                const rect = railRef.current?.getBoundingClientRect();
                const target = (e.currentTarget as HTMLElement).getBoundingClientRect();
                if (rect) {
                  onHover({
                    item: it,
                    x: target.left + target.width / 2 - rect.left,
                    y: target.top + target.height / 2 - rect.top,
                  });
                }
              }}
              onBlur={() => {
                setActiveId(null);
                onHover(null);
              }}
              aria-label={`${it.service} at ${it.time} with ${it.client}`}
              className={cn(
                "absolute rounded-sm transition-all",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              )}
              style={{
                left: `${left}%`,
                width: `${Math.max(width, 1.2)}%`,
                height: h,
                top: RAIL_HEIGHT / 2 - h / 2,
                background: style.bg,
                border: `1px solid ${style.fg}`,
                opacity: isPast ? 0.5 : 1,
              }}
            />
          );
        })}
      </div>
      <div className="relative mt-2" style={{ height: 16 }}>
        {ticks.map((h) => (
          <div
            key={h}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: `${pct(h * 60, startMin, endMin)}%`, transform: "translateX(-50%)" }}
          >
            <span
              className="block w-px"
              style={{ height: 4, background: "var(--line)" }}
            />
            <span className="block text-[10px] font-mono text-ink-4 mt-1">
              {String(h).padStart(2, "0")}:00
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HoverBadge({ info }: { info: HoverInfo }) {
  return (
    <div
      className="pointer-events-none absolute z-10 bg-ink text-paper rounded-md shadow-3 px-2.5 py-1.5"
      style={{
        left: Math.max(0, info.x - 8),
        top: -8,
        transform: "translate(-50%, -100%)",
        minWidth: 140,
      }}
    >
      <div className="text-[11px] font-medium leading-tight">
        {info.item.service}
      </div>
      <div className="text-[10.5px] text-paper/70 leading-tight mt-0.5">
        {info.item.client}
      </div>
    </div>
  );
}

export function NextSessionCard({ item, schedule }: Props) {
  const [hover, setHover] = React.useState<HoverInfo | null>(null);
  const { openBookingDrawer } = useDrawers();
  const [booking, setBooking] = React.useState<Booking | null>(null);

  React.useEffect(() => {
    let alive = true;
    if (item?.bookingId) {
      getBooking(item.bookingId).then((b) => {
        if (alive) setBooking(b);
      });
    } else {
      setBooking(null);
    }
    return () => {
      alive = false;
    };
  }, [item?.bookingId]);

  if (!item) {
    return (
      <Card padded className="text-small text-ink-3">No upcoming sessions today.</Card>
    );
  }

  const style = EVENT_STYLE;
  const hours = totalBookedHours(schedule);

  const openView = () => {
    if (booking) openBookingDrawer({ initial: booking, mode: "view" });
  };
  const openEdit = () => {
    if (booking) openBookingDrawer({ initial: booking, mode: "edit" });
  };

  return (
    <Card padded={false} className="relative h-full flex flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 -translate-x-1/2"
        style={{ top: -180, width: 0, height: 0 }}
      >
        {[460, 320, 200].map((d, i) => (
          <span
            key={d}
            className="absolute rounded-full"
            style={{
              width: d,
              height: d,
              left: -d / 2,
              top: -d / 2,
              border: "1px solid var(--accent)",
              opacity: 0.14 + i * 0.06,
            }}
          />
        ))}
      </div>

      <CardHead
        title="Next session"
        right={<Pill tone="accent" icon="clock">in 2h 14m</Pill>}
      />
      <div className="relative flex-1 flex flex-col">
        <div className="relative px-6 pt-5 pb-5">
          <div className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 font-medium">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: style.fg }}
            />
            {item.service}
          </div>
          <div className="text-small text-ink-3 mt-1">
            {item.time} – {item.end} · {item.duration}
          </div>

          <div className="mt-4 flex items-stretch gap-5">
            <div
              className="font-serif text-ink flex-shrink-0"
              style={{
                fontSize: "clamp(48px, 6vw, 64px)",
                fontWeight: 360,
                lineHeight: 1,
                letterSpacing: "-0.025em",
              }}
            >
              {item.time}
            </div>
            <div
              aria-hidden
              className="w-px self-stretch"
              style={{ background: "var(--line-soft)" }}
            />
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Avatar name={item.client} size={40} />
              <div className="min-w-0">
                <div className="text-[15px] text-ink truncate">{item.client}</div>
                {item.company && (
                  <div className="text-small text-ink-3 truncate">{item.company}</div>
                )}
                <div className="text-small text-ink-3 truncate">
                  {item.client.toLowerCase().replace(/\s+/g, ".")}@example.com
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-5">
            <Button variant="primary" size="sm" icon="video">Join Meet</Button>
            <Button variant="secondary" size="sm" icon="copy">Copy link</Button>
            <Button
              variant="secondary"
              size="sm"
              icon="eye"
              onClick={openView}
              disabled={!booking}
            >
              View details
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon="refresh"
              onClick={openEdit}
              disabled={!booking}
            >
              Reschedule
            </Button>
          </div>
        </div>

        <div className="relative mt-auto border-t border-line-soft px-6 pt-4 pb-4 bg-surface-warm/60">
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-small text-ink-2 font-medium">Today&apos;s schedule</div>
            <div className="text-micro font-mono text-ink-3 uppercase tracking-widest">
              {schedule.length} sessions · {hours}h booked
            </div>
          </div>
          <div className="relative">
            <ScheduleRail items={schedule} onHover={setHover} />
            {hover && <HoverBadge info={hover} />}
          </div>
        </div>
      </div>
    </Card>
  );
}
