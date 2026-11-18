"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Avatar } from "@/components/ui/Avatar";
import { CardHead } from "@/components/shared/CardHead";
import { useDrawers } from "@/components/drawers/DrawersProvider";
import { getBooking } from "@/services/bookings.service";
import type { DashboardScheduleItem } from "@/types/dashboard";
import type { Booking } from "@/types/booking";
import { localeForLang } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { dataSource } from "@/lib/env";
import { MoveBookingDialog } from "@/components/admin/bookings/MoveBookingDialog";
import { clockIn } from "@/lib/calendar";
import { useWorkspaceTimezone } from "@/lib/use-workspace-timezone";

const EVENT_STYLE = { bg: "#E7EDE3", fg: "#2A3F2A" };

type Props = {
  item?: DashboardScheduleItem;
  /** Called after the booking was moved, so the dashboard can reload. */
  onChanged?: () => void;
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

const subscribeMinute = (onChange: () => void) => {
  const id = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(id);
};
const currentMinute = () => Math.floor(Date.now() / 60_000);
const noMinute = () => null;

/** "in 2h 14m" until a call today, "tomorrow" / "in 3 days" later on, "Now" once started. */
function Countdown({ startISO }: { startISO: string }) {
  const { t, lang } = useI18n();
  const minute = React.useSyncExternalStore(subscribeMinute, currentMinute, noMinute);
  if (minute === null) return null;
  const minutes = Math.ceil((Date.parse(startISO) - minute * 60_000) / 60_000);
  let label: string;
  if (minutes <= 0) label = t("dashboard.countdown.now");
  else if (minutes < 60) label = t("dashboard.countdown.minutes", { m: minutes });
  else if (minutes < 24 * 60) label = t("dashboard.countdown.hours", { h: Math.floor(minutes / 60), m: minutes % 60 });
  else {
    const days = Math.round(minutes / (24 * 60));
    label = new Intl.RelativeTimeFormat(localeForLang(lang), { numeric: "auto" }).format(days, "day");
  }
  return <Pill tone="accent" icon="clock">{label}</Pill>;
}

/** Today's "now" on the rail, in the workspace's timezone; glides as the minutes pass. */
function NowMarker({ startMin, endMin }: { startMin: number; endMin: number }) {
  const { t: uiText } = useI18n();
  const timezone = useWorkspaceTimezone();
  const minute = React.useSyncExternalStore(subscribeMinute, currentMinute, noMinute);
  if (minute === null) return null;
  const clock = clockIn(new Date(minute * 60_000).toISOString(), timezone);
  const at = pct(toMinutes(clock), startMin, endMin);
  if (at < 0 || at > 100) return null;
  // A full-width layer moved by a transform (never animating `left`), clipped to the rail.
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" role="img" aria-label={uiText("ui.now.at", { time: clock })}>
      <div
        className="absolute inset-0 transition-transform duration-(--d-entrance) ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(${at}%)` }}
      >
        <span className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full bg-accent" />
      </div>
    </div>
  );
}

function ScheduleRail({
  items,
  onHover,
}: {
  items: DashboardScheduleItem[];
  onHover: (info: HoverInfo | null) => void;
}) {
  const { t: uiText } = useI18n();
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
        <NowMarker startMin={startMin} endMin={endMin} />
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
              aria-label={uiText("ui.session.accessible", { service: it.service, time: it.time, client: it.client })}
              className={cn(
                "absolute rounded-sm transition-[opacity,box-shadow,background-color] duration-(--d-fade) ease-out",
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
            <span className="block text-[10px] font-mono text-ink-3 mt-1">
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

/** Today's sessions on a rail, with a "now" marker. Sits under "Your next call". */
export function ScheduleCard({ schedule }: { schedule: DashboardScheduleItem[] }) {
  const { t: uiText } = useI18n();
  const [hover, setHover] = React.useState<HoverInfo | null>(null);
  const hours = totalBookedHours(schedule);
  return (
    <Card padded={false} className="min-w-0 flex flex-col">
      <CardHead
        title={uiText("ui.today.s.schedule")}
        right={
          <span className="text-micro text-ink-3 tabular-nums">
            {schedule.length} {uiText("ui.sessions")} · {hours} {uiText("ui.h.booked")}
          </span>
        }
      />
      <div className="relative px-6 pt-5 pb-4">
        <ScheduleRail items={schedule} onHover={setHover} />
        {hover && <HoverBadge info={hover} />}
      </div>
    </Card>
  );
}

export function NextSessionCard({ item, onChanged }: Props) {
  const { t: uiText, lang } = useI18n();
  const { openBookingDrawer } = useDrawers();
  const [loaded, setLoaded] = React.useState<Booking | null>(null);
  const [moving, setMoving] = React.useState(false);
  const booking = item?.bookingId && loaded?.id === item.bookingId ? loaded : null;

  React.useEffect(() => {
    if (!item?.bookingId) return;
    let alive = true;
    getBooking(item.bookingId).then((b) => {
      if (alive) setLoaded(b);
    });
    return () => {
      alive = false;
    };
  }, [item?.bookingId]);

  if (!item) {
    return (
      <Card padded={false} className="min-w-0 flex flex-col">
        <CardHead title={uiText("dashboard.nextCall")} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-10 text-center">
          <span className="flex items-center justify-center rounded-2xl bg-accent-soft p-4 text-accent border border-accent/15">
            <Icon name="calendar-days" size={32} />
          </span>
          <div className="min-w-0 w-full max-w-sm space-y-2">
            <h2 className="text-h2">{uiText("dashboard.emptyTitle")}</h2>
            <p className="text-small text-ink-3">{uiText("dashboard.emptyBody")}</p>
          </div>
          <Link href="/admin/calendar"><Button variant="secondary" icon="calendar">{uiText("dashboard.openCalendar")}</Button></Link>
        </div>
      </Card>
    );
  }

  const style = EVENT_STYLE;

  const openView = () => {
    if (booking) openBookingDrawer({ initial: booking, mode: "view" });
  };
  const openEdit = () => {
    if (booking) openBookingDrawer({ initial: booking, mode: "edit" });
  };
  const reschedule = () => (dataSource === "api" ? setMoving(true) : openEdit());

  return (
    <>
    <Card padded={false} className="relative flex flex-col overflow-hidden">
      <CardHead
        title={uiText("dashboard.nextCall")}
        right={item.startISO ? <Countdown startISO={item.startISO} /> : undefined}
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
            {item.startISO && <>{new Intl.DateTimeFormat(localeForLang(lang), {weekday: "short", day: "numeric", month: "short", timeZone: item.timezone}).format(new Date(item.startISO))} · </>}{item.time} – {item.end} · {item.duration}
          </div>

          {/* Phones: the time sits above the client, so the name keeps its width. */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-5">
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
              className="hidden sm:block w-px self-stretch"
              style={{ background: "var(--line-soft)" }}
            />
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Avatar name={item.client} size={40} />
              <div className="min-w-0">
                <div className="text-[15px] text-ink truncate">{item.client}</div>
                {item.company && (
                  <div className="text-small text-ink-3 truncate">{item.company}</div>
                )}
                {item.clientEmail && (
                  <div className="text-small text-ink-3 truncate">
                    {item.clientEmail}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-5">
            <Button variant="primary" size="sm" icon="video">{uiText("ui.join.meet")}</Button>
            <Button variant="secondary" size="sm" icon="copy">{uiText("ui.copy.link")}</Button>
            <Button
              variant="secondary"
              size="sm"
              icon="eye"
              onClick={openView}
              disabled={!booking}
            >
              {uiText("ui.view.details")}</Button>
            <Button
              variant="ghost"
              size="sm"
              icon="refresh"
              onClick={reschedule}
              disabled={!booking}
            >
              {uiText("ui.reschedule")}</Button>
          </div>
        </div>

      </div>
    </Card>
    <MoveBookingDialog
      open={moving}
      onClose={() => setMoving(false)}
      booking={booking}
      onMoved={() => onChanged?.()}
    />
    </>
  );
}
