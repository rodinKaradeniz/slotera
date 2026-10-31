"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { WorkingHoursForm } from "@/components/shared/forms/WorkingHoursForm";
import { useToast } from "@/components/ui/Toast";
import { updateAvailabilitySettings, availabilityToWorkingDays, workingDaysToWeeklyHours, updateSettings, type AvailabilitySettings } from "@/services/settings.service";
import { CalendarFeedCard } from "./CalendarFeedCard";
import type { WorkingDay } from "@/types/settings";
import { PanelProps, PanelCard } from "./PanelCard";

export function BookingTermsPanel({ data, onChange }: PanelProps) {
  const [value, setValue] = React.useState({
    enabled: data.payments.bookingTerms.enabled,
    content: data.payments.bookingTerms.content,
  });

  const save = async () => {
    const next = await updateSettings({
      payments: {
        ...data.payments,
        bookingTerms: value,
      },
    });
    onChange(next);
  };

  return (
    <PanelCard
      title="Booking Terms"
      hint="Your own booking terms. Shown to clients during checkout, separate from Slotera's platform terms."
      onSave={save}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between pb-4 border-b border-line-soft">
          <div>
            <div className="text-[14px] font-medium text-ink">
              Enable custom booking terms
            </div>
            <div className="text-small">
              Shown to clients on the booking page when they open the Terms and Privacy modal.
            </div>
          </div>
          <Toggle
            checked={value.enabled}
            onChange={(enabled) => setValue({ ...value, enabled })}
          />
        </div>
        <Field
          label="Terms content"
          hint="Plain text. Cancellation window, refund policy, no-show rules, etc."
        >
          <Textarea
            value={value.content}
            rows={8}
            disabled={!value.enabled}
            placeholder="Cancellations and rescheduling are free up to 24 hours before your session..."
            onChange={(e) => setValue({ ...value, content: e.target.value })}
          />
        </Field>
      </div>
    </PanelCard>
  );
}

export function CalendarPanel({ data, onChange }: PanelProps) {
  const [hours, setHours] = React.useState<WorkingDay[]>(data.calendar.workingHours);
  const save = async () => {
    const next = await updateSettings({
      calendar: { ...data.calendar, workingHours: hours },
    });
    onChange(next);
  };
  return (
    <>
      <Card padded>
        <div className="mb-4">
          <h2 className="text-h3 text-ink" style={{ fontSize: 18 }}>Calendar Connections</h2>
          <p className="text-small mt-1">Two-way sync prevents double-booking.</p>
        </div>
        {data.calendar.connections.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 py-3 border-b border-line-soft last:border-b-0"
          >
            <span className="w-9 h-9 rounded-md bg-paper-2 text-ink-2 flex items-center justify-center">
              <Icon name="calendar" size={16} />
            </span>
            <div className="flex-1">
              <div className="text-[14px] font-medium text-ink">{c.label}</div>
              <div className="text-small">{c.detail}</div>
            </div>
            <Pill tone={c.status === "connected" ? "accent" : "neutral"}>
              {c.status === "connected" ? "Connected" : "Not connected"}
            </Pill>
            <Button variant="secondary" size="sm">
              {c.status === "connected" ? "Manage" : "Connect"}
            </Button>
          </div>
        ))}
      </Card>

      <PanelCard title="Working Hours" onSave={save}>
        <WorkingHoursForm value={hours} onChange={setHours} />
      </PanelCard>
    </>
  );
}

export function ApiCalendarPanel({
  availability,
  onChange,
}: {
  availability: AvailabilitySettings;
  onChange: (next: AvailabilitySettings) => void;
}) {
  const { toast } = useToast();
  const [local, setLocal] = React.useState(availability);
  const [hours, setHours] = React.useState<WorkingDay[]>(() =>
    availabilityToWorkingDays(availability),
  );
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    const weeklyHours = workingDaysToWeeklyHours(hours);
    setSaving(true);
    try {
      const next = await updateAvailabilitySettings({ ...local, weeklyHours });
      setLocal(next);
      setHours(availabilityToWorkingDays(next));
      onChange(next);
      toast.success("Calendar settings saved");
    } catch (error) {
      toast.error("Couldn't save calendar settings", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const numericField = (
    key:
      | "slotIntervalMin"
      | "bufferBeforeMin"
      | "bufferAfterMin"
      | "minimumNoticeMin"
      | "maximumAdvanceDays"
      | "customerChangeNoticeHours",
  ) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    setLocal({ ...local, [key]: Number.isFinite(value) ? value : 0 });
  };

  return (
    <>
      <CalendarFeedCard />

      <Card padded>
        <div className="mb-4">
          <h2 className="text-h3 text-ink" style={{ fontSize: 18 }}>Availability</h2>
          <p className="text-small mt-1">
            These workspace-wide rules shape future public availability. They do not
            create bookings or consume session capacity.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mb-5">
          <Field label="Workspace timezone">
            <Input
              value={local.timezone}
              onChange={(event) => setLocal({ ...local, timezone: event.target.value })}
              placeholder="Europe/Berlin"
            />
          </Field>
          <Field label="Slot interval (min)">
            <Input type="number" min={5} value={String(local.slotIntervalMin)} onChange={numericField("slotIntervalMin")} />
          </Field>
          <Field label="Buffer before (min)">
            <Input type="number" min={0} value={String(local.bufferBeforeMin)} onChange={numericField("bufferBeforeMin")} />
          </Field>
          <Field label="Buffer after (min)">
            <Input type="number" min={0} value={String(local.bufferAfterMin)} onChange={numericField("bufferAfterMin")} />
          </Field>
          <Field label="Minimum notice (min)">
            <Input type="number" min={0} value={String(local.minimumNoticeMin)} onChange={numericField("minimumNoticeMin")} />
          </Field>
          <Field label="Maximum advance (days)">
            <Input type="number" min={1} value={String(local.maximumAdvanceDays)} onChange={numericField("maximumAdvanceDays")} />
          </Field>
          <Field
            label="Client changes allowed until (hours before)"
            hint="Clients can cancel or move a booking themselves from their email link until then."
          >
            <Input type="number" min={0} max={720} value={String(local.customerChangeNoticeHours)} onChange={numericField("customerChangeNoticeHours")} />
          </Field>
        </div>
        <div className="border-t border-line-soft pt-5">
          <h3 className="text-[13px] font-medium text-ink mb-2">Working hours</h3>
          <WorkingHoursForm value={hours} onChange={setHours} disabled={saving} />
        </div>
        <div className="flex justify-end mt-5 pt-4 border-t border-line-soft">
          <Button variant="primary" onClick={save} loading={saving}>Save availability</Button>
        </div>
      </Card>

      {local.blackouts.length > 0 && (
        <PanelCard
          title="Blackout dates"
          hint="Existing blackout ranges are preserved when availability is saved."
        >
          <div className="flex flex-col gap-2">
            {local.blackouts.map((blackout) => (
              <div key={blackout.id ?? `${blackout.startsAt}-${blackout.endsAt}`} className="text-small text-ink-2">
                {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(blackout.startsAt))}
                {" – "}
                {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(blackout.endsAt))}
                {blackout.reason ? ` · ${blackout.reason}` : ""}
              </div>
            ))}
          </div>
        </PanelCard>
      )}
    </>
  );
}
