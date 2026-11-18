"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { buildMonthGrid, localDateKey, sameDay, slotParts } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localeForLang } from "@/lib/i18n";
import type { Service } from "@/types/service";
import {
  listPublicAvailability,
  type PublicAvailability,
} from "@/services/public-booking.service";

// Monday-first short weekday labels, derived from the active locale.
function weekdayShorts(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
  // 2024-01-01 is a Monday.
  return Array.from({ length: 7 }, (_, i) =>
    fmt.format(new Date(Date.UTC(2024, 0, 1 + i))),
  );
}

type Props = {
  service: Service;
  date: string | null;
  time: string | null;
  startAt: string | null;
  onChange: (next: {
    date: string | null;
    time: string | null;
    startAt: string | null;
  }) => void;
};

export function StepDateTime({ service, date, time, startAt, onChange }: Props) {
  const { t, lang } = useI18n();
  const locale = localeForLang(lang);
  const daysShort = React.useMemo(() => weekdayShorts(locale), [locale]);
  const monthLabel = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }),
    [locale],
  );
  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [anchor, setAnchor] = React.useState<Date>(() => {
    if (date) return new Date(date);
    return today;
  });
  const [apiAvailability, setApiAvailability] =
    React.useState<PublicAvailability | null>(null);

  // Both modes ask the same availability service: the API in production, the
  // server's rules over demo data in the demo.
  React.useEffect(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    let cancelled = false;
    listPublicAvailability(service.id, localDateKey(first), localDateKey(last)).then((result) => {
      if (!cancelled) setApiAvailability(result);
    });
    return () => {
      cancelled = true;
    };
  }, [anchor, service.id]);

  const cells = React.useMemo(() => buildMonthGrid(anchor), [anchor]);
  const selectedDate = date ? new Date(date) : null;
  const apiSlots = React.useMemo(
    () =>
      (apiAvailability?.items ?? []).map((slot) => ({
        ...slot,
        ...slotParts(slot.startAt, apiAvailability?.timezone ?? "UTC"),
      })),
    [apiAvailability],
  );
  const availableDates = React.useMemo(
    () => new Set(apiSlots.map((slot) => slot.date)),
    [apiSlots],
  );
  const visibleTimes = apiSlots.filter((slot) => slot.date === date);
  const monthIsEmpty = apiAvailability !== null && apiSlots.length === 0;

  const go = (months: number) => {
    const next = new Date(anchor);
    next.setDate(1);
    next.setMonth(next.getMonth() + months);
    setAnchor(next);
  };

  const pickDate = (d: Date) => {
    const iso = localDateKey(d);
    if (d < today || !availableDates.has(iso)) return;
    onChange({ date: iso, time: null, startAt: null });
  };

  const pickTime = (slotTime: string, slotStartAt: string) => {
    if (!date) return;
    onChange({
      date,
      time: slotTime,
      startAt: slotStartAt,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-stretch h-full">
      <Card padded={false} className="flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft">
          <button
            type="button"
            onClick={() => go(-1)}
            className="w-8 h-8 rounded-md hover:bg-paper-2 text-ink-3 flex items-center justify-center"
            aria-label={t("booking.datetime.prevMonth")}
          >
            <Icon name="chevron-l" size={16} />
          </button>
          <div className="font-serif text-ink" style={{ fontSize: 17 }}>
            {monthLabel.format(anchor)}
          </div>
          <button
            type="button"
            onClick={() => go(1)}
            className="w-8 h-8 rounded-md hover:bg-paper-2 text-ink-3 flex items-center justify-center"
            aria-label={t("booking.datetime.nextMonth")}
          >
            <Icon name="chevron-r" size={16} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 px-4 pt-3">
          {daysShort.map((d, i) => (
            <div key={i} className="text-center text-micro py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 px-4 pb-4 flex-1 auto-rows-fr">
          {cells.map((c) => {
            const past = c.date < today;
            const avail = availableDates.has(localDateKey(c.date));
            const selected = !!selectedDate && sameDay(c.date, selectedDate);
            const disabled = past || !avail || !c.inMonth;
            return (
              <button
                key={c.iso}
                type="button"
                onClick={() => pickDate(c.date)}
                disabled={disabled}
                className={cn(
                  "press relative flex flex-col items-center justify-center min-h-12 rounded-md text-[14px] tabular-nums",
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

      <Card padded className="flex flex-col h-full">
        <div className="eyebrow mb-3">{t("booking.datetime.availableTimes")}</div>
        {!date ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-small text-center max-w-[24ch]">
              {t(monthIsEmpty ? "booking.datetime.noneThisMonth" : "booking.datetime.pickDate")}
            </p>
          </div>
        ) : (
          <div className="list-rise grid grid-cols-2 gap-2 flex-1 auto-rows-fr">
            {visibleTimes.map((slot) => {
              const active = time === slot.time && startAt === slot.startAt;
              return (
                <button
                  key={slot.startAt}
                  type="button"
                  onClick={() => pickTime(slot.time, slot.startAt)}
                  className={cn(
                    "press min-h-11 rounded-md border text-[14px] font-medium tabular-nums",
                    active
                      ? "bg-accent text-white border-accent"
                      : "bg-surface text-ink border-line hover:border-ink-3",
                  )}
                >
                  {slot.time}
                  {"spotsLeft" in slot && typeof slot.spotsLeft === "number" && (
                    <span className="block text-micro opacity-80">
                      {t("booking.datetime.spotsLeft").replace("{count}", String(slot.spotsLeft))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
