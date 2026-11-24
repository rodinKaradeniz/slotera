"use client";

import * as React from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { LoadError } from "@/components/shared/LoadError";
import { ConflictWarning } from "@/components/shared/ConflictWarning";
import { AddressPicker } from "@/components/shared/forms/AddressPicker";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { slotParts } from "@/lib/calendar";
import { fmtDayShort } from "@/lib/time";
import { useWorkspaceTimezone } from "@/lib/use-workspace-timezone";
import type { SessionUpdateScope } from "@/services/sessions.service";
import type { Service } from "@/types/service";
import type { Recurring, SessionItem, SessionStatus } from "@/types/session";
import type { LocationType } from "@/types/common";
import type { Address, WorkspaceLocation } from "@/types/address";

export type FormState = {
  serviceId: string;
  date: string;
  time: string;
  durationMin: number;
  capacity: number;
  locationType: LocationType;
  location: string;
  /** Optional structured address. Only used when locationType is physical/hybrid. */
  address?: Address;
  recurring: Recurring;
  /** The custom rule: every `intervalWeeks` weeks on these ISO weekdays. */
  intervalWeeks: number;
  weekdays: number[];
  status: SessionStatus;
  notes: string;
};

/** ISO weekday (1 = Monday) of a yyyy-mm-dd date. */
const isoWeekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay() || 7;

export function toForm(item: SessionItem, services: Service[], timezone: string): FormState {
  const start = new Date(item.startISO);
  const end = new Date(item.endISO);
  const wall = slotParts(item.startISO, timezone);
  const duration = Math.round((end.getTime() - start.getTime()) / 60000);
  const fallback = services[0];
  return {
    serviceId: item.serviceId ?? fallback?.id ?? "",
    date: wall.date,
    time: wall.time,
    durationMin: duration,
    capacity: item.capacity,
    locationType: item.locationType,
    location: item.location,
    address: item.address,
    recurring: item.recurring,
    intervalWeeks: 1,
    weekdays: [],
    status: item.status,
    notes: item.notes ?? "",
  };
}

export function emptyForm(services: Service[]): FormState {
  const first = services[0];
  const next = new Date();
  next.setHours(10, 0, 0, 0);
  return {
    serviceId: first?.id ?? "",
    date: next.toISOString().slice(0, 10),
    time: "10:00",
    durationMin: first?.durationMin ?? 60,
    capacity: first?.capacity ?? 1,
    locationType: first?.locationType ?? "online",
    location: first?.location ?? "Zoom",
    address: first?.address ? { ...first.address } : undefined,
    recurring: "one-off",
    intervalWeeks: 1,
    weekdays: [],
    status: "scheduled",
    notes: "",
  };
}

/** The session's service, time, capacity, place, recurrence and (while creating) its note. */
export function SessionDetailsForm({
  form, setForm, services, savedLocations, initial, isEdit, isView, scope, setScope,
  serviceSearch, setServiceSearch, lookupError, onRetryLookup, conflict, busy, onCancelSession,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  services: Service[];
  savedLocations: WorkspaceLocation[];
  initial?: SessionItem | null;
  isEdit: boolean;
  isView: boolean;
  scope: SessionUpdateScope;
  setScope: (scope: SessionUpdateScope) => void;
  serviceSearch: string;
  setServiceSearch: (value: string) => void;
  lookupError: string | null;
  onRetryLookup: () => void;
  conflict: SessionItem | null;
  busy: boolean;
  onCancelSession: () => void;
}) {
  const { t: uiText } = useI18n();
  const timezone = useWorkspaceTimezone();
  return (
    <fieldset disabled={isView} className="flex flex-col gap-5 disabled:opacity-90">
      {isEdit && initial?.recurring !== "one-off" && <Field label={uiText("session.changeScope")}>
        <Select value={scope} onChange={(event) => {setScope(event.target.value as SessionUpdateScope); setForm((current) => ({...current, date: slotParts(initial!.startISO, timezone).date}));}}
          options={[{value: "this", label: uiText("session.this")}, {value: "this_and_following", label: uiText("session.following")}]} />
      </Field>}
      <Input value={serviceSearch} placeholder={uiText("common.search")} onChange={(event) => setServiceSearch(event.target.value)} />
      {lookupError && <LoadError message={lookupError} onRetry={onRetryLookup} />}
      <Field label={uiText("ui.service")} required>
        <Select
          disabled={scope === "this_and_following" || (initial?.bookedCount ?? 0) > 0}
          value={form.serviceId}
          onChange={(e) => {
            const id = e.target.value;
            const svc = services.find((s) => s.id === id);
            setForm({
              ...form,
              serviceId: id,
              durationMin: svc?.durationMin ?? form.durationMin,
              capacity: svc?.capacity ?? form.capacity,
              locationType: svc?.locationType ?? form.locationType,
              location: svc?.location ?? form.location,
              // Inherit the service's default address (if any). When the new
              // service has none, clear — the operator can re-attach manually.
              address: svc?.address ? { ...svc.address } : undefined,
            });
          }}
          options={[{value: "", label: uiText("lookup.chooseService")}, ...services.map((s) => ({ value: s.id, label: s.name }))]}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={uiText("ui.date")} required>
          <Input
            type="date"
            disabled={scope === "this_and_following"}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </Field>
        <Field label={uiText("ui.start.time")} required>
          <Input
            type="time"
            value={form.time}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label={uiText("ui.duration.min")}>
          <Input
            type="number"
            value={String(form.durationMin)}
            onChange={(e) =>
              setForm({ ...form, durationMin: Number(e.target.value) || 0 })
            }
            min={5}
          />
        </Field>
        <Field label={uiText("ui.capacity")}>
          <Input
            type="number"
            value={String(form.capacity)}
            onChange={(e) =>
              setForm({ ...form, capacity: Math.max(1, Number(e.target.value) || 1) })
            }
            min={1}
          />
        </Field>
      </div>

      {conflict && <ConflictWarning />}

      <div className="grid grid-cols-2 gap-4">
        <Field label={uiText("ui.location.type")}>
          <Select
            value={form.locationType}
            onChange={(e) =>
              setForm({ ...form, locationType: e.target.value as LocationType })
            }
            options={[
              { value: "online", label: uiText("ui.online") },
              { value: "physical", label: uiText("ui.in.person") },
              { value: "hybrid", label: uiText("ui.hybrid") },
            ]}
          />
        </Field>
        <Field label={uiText("ui.recurrence")}>
          <Select
            disabled={isEdit}
            value={form.recurring}
            onChange={(e) => {
              const recurring = e.target.value as Recurring;
              // A custom rule starts on the start date's weekday; the operator adds others.
              const weekdays = form.weekdays.length ? form.weekdays : [isoWeekday(form.date)];
              setForm({ ...form, recurring, weekdays: recurring === "custom" ? weekdays : form.weekdays });
            }}
            options={[
              { value: "one-off", label: uiText("ui.one.off") },
              { value: "weekly", label: uiText("ui.weekly") },
              { value: "custom", label: uiText("ui.custom") },
            ]}
          />
        </Field>
      </div>

      {!isEdit && form.recurring === "custom" && (
        <div className="grid grid-cols-1 sm:grid-cols-[8rem_minmax(0,1fr)] gap-4">
          <Field label={uiText("session.repeatEvery")}>
            <Input type="number" min={1} max={52} value={form.intervalWeeks || ""} suffix={uiText("session.weeks")}
              onChange={(e) => setForm({ ...form, intervalWeeks: Number(e.target.value) })} />
          </Field>
          <Field label={uiText("session.onDays")} group>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                const on = form.weekdays.includes(day);
                return (
                  <Button key={day} type="button" size="sm" variant={on ? "primary" : "secondary"} aria-pressed={on}
                    onClick={() => setForm({ ...form, weekdays: on ? form.weekdays.filter((d) => d !== day) : [...form.weekdays, day].sort() })}>
                    {fmtDayShort(new Date(Date.UTC(2024, 0, day, 12)))}
                  </Button>
                );
              })}
            </div>
          </Field>
        </div>
      )}

      <Field label={uiText("ui.meeting.location.detail")}>
        <Input
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />
      </Field>

      {form.locationType !== "online" && (
        <AddressPicker
          value={form.address}
          onChange={(address) => setForm({ ...form, address })}
          savedLocations={savedLocations}
          title={uiText("ui.physical.address")}
          description={uiText("ui.shown.to.attendees.on.the.booking.confirmation")}
        />
      )}

      {/* For an existing session the internal note lives in the Notes &
          Actions tab; while creating, keep it inline here. */}
      {!isEdit && (
        <Field
          label={uiText("ui.internal.notes")}
          optional
          hint={uiText("ui.only.visible.to.you.use.for.session.specific.reminders.or.attendee.context")}
        >
          <Textarea
            value={form.notes}
            rows={3}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
      )}

      {isEdit && !isView && (
        <div className="pt-5 border-t border-line-soft flex justify-end">
          <Button
            variant="danger"
            size="sm"
            icon="x"
            onClick={onCancelSession}
            disabled={busy}
          >
            {uiText("ui.cancel.session")}</Button>
        </div>
      )}
    </fieldset>
  );
}
