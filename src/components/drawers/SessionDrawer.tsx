"use client";

import * as React from "react";
import { DrawerShell } from "@/components/ui/DrawerShell";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ConflictWarning } from "@/components/shared/ConflictWarning";
import { AttendanceTab } from "./AttendanceTab";
import {
  createSession,
  updateSession,
  cancelSession,
  findConflict,
} from "@/services/sessions.service";
import { listServices } from "@/services/services.service";
import { addMinutes } from "@/lib/time";
import type { Service } from "@/types/service";
import type { Recurring, SessionItem, SessionStatus } from "@/types/session";
import type { LocationType } from "@/types/common";

export type SessionDrawerMode = "view" | "edit";

export type SessionDrawerProps = {
  open: boolean;
  onClose: () => void;
  initial?: SessionItem | null;
  mode?: SessionDrawerMode;
  onSaved?: (s: SessionItem) => void;
  onCancelled?: (s: SessionItem) => void;
};

type FormState = {
  serviceId: string;
  date: string;
  time: string;
  durationMin: number;
  capacity: number;
  locationType: LocationType;
  location: string;
  recurring: Recurring;
  status: SessionStatus;
  notes: string;
};

function toForm(item: SessionItem, services: Service[]): FormState {
  const start = new Date(item.startISO);
  const end = new Date(item.endISO);
  const duration = Math.round((end.getTime() - start.getTime()) / 60000);
  const fallback = services[0];
  return {
    serviceId: item.serviceId ?? fallback?.id ?? "",
    date: start.toISOString().slice(0, 10),
    time: start.toISOString().slice(11, 16),
    durationMin: duration,
    capacity: item.capacity,
    locationType: item.locationType,
    location: item.location,
    recurring: item.recurring,
    status: item.status,
    notes: item.notes ?? "",
  };
}

function emptyForm(services: Service[]): FormState {
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
    recurring: "one-off",
    status: "scheduled",
    notes: "",
  };
}

export function SessionDrawer({
  open,
  onClose,
  initial,
  mode: modeProp = "edit",
  onSaved,
  onCancelled,
}: SessionDrawerProps) {
  const isEdit = !!initial;
  const { toast } = useToast();
  const [mode, setMode] = React.useState<SessionDrawerMode>(modeProp);
  const isView = mode === "view" && isEdit;
  const [services, setServices] = React.useState<Service[]>([]);
  const [form, setForm] = React.useState<FormState>(() => emptyForm([]));
  const [conflict, setConflict] = React.useState<SessionItem | null>(null);
  const [busy, setBusy] = React.useState(false);
  // Attendance only makes sense for an existing group session — for new or 1:1
  // sessions we render the details body directly and skip the tab control.
  const canShowAttendance = isEdit && (initial?.capacity ?? 0) > 1;
  const [tab, setTab] = React.useState<"details" | "attendance">("details");

  React.useEffect(() => {
    if (open) {
      setMode(modeProp);
      setTab("details");
    }
  }, [open, modeProp]);

  React.useEffect(() => {
    listServices().then(setServices);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setForm(initial ? toForm(initial, services) : emptyForm(services));
    setConflict(null);
  }, [open, initial, services]);

  const startISO = React.useMemo(() => {
    return `${form.date}T${form.time}:00.000Z`;
  }, [form.date, form.time]);

  const endISO = React.useMemo(() => {
    const end = addMinutes(form.time, form.durationMin);
    return `${form.date}T${end}:00.000Z`;
  }, [form.date, form.time, form.durationMin]);

  React.useEffect(() => {
    if (!open) return;
    let live = true;
    findConflict({ startISO, endISO, id: initial?.id }).then((c) => {
      if (live) setConflict(c);
    });
    return () => {
      live = false;
    };
  }, [open, startISO, endISO, initial?.id]);

  const save = async () => {
    setBusy(true);
    try {
      if (isEdit && initial) {
        const next = await updateSession(initial.id, {
          serviceId: form.serviceId,
          startISO,
          endISO,
          capacity: form.capacity,
          bookedCount: initial.bookedCount,
          status: form.status,
          locationType: form.locationType,
          location: form.location,
          recurring: form.recurring,
          notes: form.notes,
        });
        onSaved?.(next);
        toast.success("Session updated");
      } else {
        const next = await createSession({
          serviceId: form.serviceId,
          startISO,
          endISO,
          capacity: form.capacity,
          bookedCount: 0,
          status: form.status,
          locationType: form.locationType,
          location: form.location,
          recurring: form.recurring,
          notes: form.notes,
        });
        onSaved?.(next);
        toast.success("Session scheduled");
      }
      onClose();
    } catch (err) {
      toast.error("Couldn't save session", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!initial) return;
    if (!confirm("Cancel this session? All bookings will be marked cancelled.")) return;
    setBusy(true);
    try {
      const next = await cancelSession(initial.id);
      onCancelled?.(next);
      toast.success("Session cancelled");
      onClose();
    } catch (err) {
      toast.error("Couldn't cancel session", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const eyebrow = isView
    ? "Session details"
    : isEdit
      ? "Edit session"
      : "New session";
  const title = isEdit ? `Session · ${initial?.id}` : "Schedule a session";

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      eyebrow={eyebrow}
      title={title}
      footer={
        tab === "attendance" ? (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        ) : isView ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button icon="edit" onClick={() => setMode("edit")}>
              Edit session
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy} disabled={!form.serviceId}>
              {isEdit ? "Save changes" : "Create session"}
            </Button>
          </>
        )
      }
    >
      {canShowAttendance && (
        <div className="mb-5">
          <Tabs
            value={tab}
            onChange={(v) => setTab(v as "details" | "attendance")}
            tabs={[
              { value: "details", label: "Details" },
              { value: "attendance", label: "Attendance" },
            ]}
          />
        </div>
      )}

      {tab === "attendance" && initial ? (
        <AttendanceTab sessionId={initial.id} />
      ) : (
      <fieldset disabled={isView} className="flex flex-col gap-5 disabled:opacity-90">
        <Field label="Service" required>
          <Select
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
              });
            }}
            options={services.map((s) => ({ value: s.id, label: s.name }))}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Date" required>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Field label="Start time" required>
            <Input
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Duration (min)">
            <Input
              type="number"
              value={String(form.durationMin)}
              onChange={(e) =>
                setForm({ ...form, durationMin: Number(e.target.value) || 0 })
              }
              min={5}
            />
          </Field>
          <Field label="Capacity">
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
          <Field label="Location type">
            <Select
              value={form.locationType}
              onChange={(e) =>
                setForm({ ...form, locationType: e.target.value as LocationType })
              }
              options={[
                { value: "online", label: "Online" },
                { value: "physical", label: "In person" },
                { value: "hybrid", label: "Hybrid" },
              ]}
            />
          </Field>
          <Field label="Recurrence">
            <Select
              value={form.recurring}
              onChange={(e) =>
                setForm({ ...form, recurring: e.target.value as Recurring })
              }
              options={[
                { value: "one-off", label: "One-off" },
                { value: "weekly", label: "Weekly" },
                { value: "custom", label: "Custom" },
              ]}
            />
          </Field>
        </div>

        <Field label="Meeting / location detail">
          <Input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </Field>

        <Field
          label="Internal notes"
          optional
          hint="Only visible to you. Use for session-specific reminders or attendee context."
        >
          <Textarea
            value={form.notes}
            rows={3}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>

        {isEdit && !isView && (
          <div className="pt-5 border-t border-line-soft flex justify-end">
            <Button variant="danger" size="sm" icon="x" onClick={cancel} disabled={busy}>
              Cancel session
            </Button>
          </div>
        )}
      </fieldset>
      )}
    </DrawerShell>
  );
}
