"use client";

import * as React from "react";
import { Input } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import type { WorkingDay } from "@/types/settings";

/**
 * Controlled editor for the operator's weekly working hours. Used by Settings
 * → Calendar → Working Hours and the onboarding stepper. Caller owns persistence.
 */
type Props = {
  value: WorkingDay[];
  onChange: (next: WorkingDay[]) => void;
  disabled?: boolean;
};

export function WorkingHoursForm({ value, onChange, disabled }: Props) {
  const updateDay = (i: number, patch: Partial<WorkingDay>) =>
    onChange(value.map((h, idx) => (i === idx ? { ...h, ...patch } : h)));

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-2 disabled:opacity-90">
      {value.map((h, i) => (
        <div
          key={h.day}
          className="grid grid-cols-[60px_auto_1fr_1fr] items-center gap-3 py-2"
        >
          <div className="text-[14px] font-medium text-ink">{h.day}</div>
          <Toggle
            checked={h.enabled}
            onChange={(v) => updateDay(i, { enabled: v })}
          />
          <Input
            type="time"
            value={h.start}
            disabled={!h.enabled}
            onChange={(e) => updateDay(i, { start: e.target.value })}
          />
          <Input
            type="time"
            value={h.end}
            disabled={!h.enabled}
            onChange={(e) => updateDay(i, { end: e.target.value })}
          />
        </div>
      ))}
    </fieldset>
  );
}
