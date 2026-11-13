"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { useResetOnOpen } from "@/lib/use-reset-on-open";
import { DrawerShell } from "@/components/ui/DrawerShell";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ConflictWarning } from "@/components/shared/ConflictWarning";
import { AddressPicker } from "@/components/shared/forms/AddressPicker";
import { AttendanceTab } from "./AttendanceTab";
import { useDrawers } from "./DrawersProvider";
import { SessionActionItems } from "./SessionActionItems";
import {
  createSession,
  updateSession,
  cancelSession,
  findConflict,
} from "@/services/sessions.service";
import { listServices } from "@/services/services.service";
import { listWorkspaceLocations } from "@/services/settings.service";
import { listActionItemsForSession } from "@/services/session-action-items.service";
import { slotParts, zonedWallToISO } from "@/lib/calendar";
import { useWorkspaceTimezone } from "@/lib/use-workspace-timezone";
import { dataSource } from "@/lib/env";
import type { Service } from "@/types/service";
import type { Recurring, SessionItem, SessionStatus } from "@/types/session";
import type { SessionActionItem } from "@/types/session-action-item";
import type { LocationType } from "@/types/common";
import type { Address, WorkspaceLocation } from "@/types/address";

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
  /** Optional structured address. Only used when locationType is physical/hybrid. */
  address?: Address;
  recurring: Recurring;
  status: SessionStatus;
  notes: string;
};

function toForm(item: SessionItem, services: Service[], timezone: string): FormState {
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
    address: first?.address ? { ...first.address } : undefined,
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
  const { t: uiText } = useI18n();
  const isEdit = !!initial;
  const { toast } = useToast();
  const timezone = useWorkspaceTimezone();
  const [mode, setMode] = React.useState<SessionDrawerMode>(modeProp);
  const { openBookingDrawer } = useDrawers();
  const isView = mode === "view" && isEdit;
  const [services, setServices] = React.useState<Service[]>([]);
  const [savedLocations, setSavedLocations] = React.useState<WorkspaceLocation[]>(
    [],
  );
  const [form, setForm] = React.useState<FormState>(() => emptyForm([]));
  const [conflict, setConflict] = React.useState<SessionItem | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [savingNote, setSavingNote] = React.useState(false);
  // Tabs appear for an existing session: "Notes & Actions" is always available,
  // "Attendance" only for a group session. New / 1:1 sessions render the details
  // body directly and keep notes inline in the details form.
  const canShowAttendance =
    isEdit && (initial?.capacity ?? 0) > 1;
  const canShowActionItems = isEdit;
  const showTabs = isEdit;
  const [tab, setTab] = React.useState<"details" | "notes" | "attendance">(
    "details",
  );
  // Action items of the open session, tagged with its id; none yet means loading.
  const [loadedActionItems, setLoadedActionItems] = React.useState<{
    sessionId: string;
    items: SessionActionItem[];
  } | null>(null);
  const actionItemsReady =
    !!initial && loadedActionItems?.sessionId === initial.id;
  const actionItems = actionItemsReady ? loadedActionItems.items : [];
  const actionItemsLoading = open && !!initial && !actionItemsReady;
  const setActionItems = (items: SessionActionItem[]) => {
    if (initial) setLoadedActionItems({ sessionId: initial.id, items });
  };
  const openActionCount = actionItems.filter((a) => a.status === "todo").length;

  useResetOnOpen(open, [modeProp], () => {
    setMode(modeProp);
    setTab("details");
    // Reopening refetches the action items instead of showing the last copy.
    setLoadedActionItems(null);
  });

  React.useEffect(() => {
    listServices().then(setServices);
    listWorkspaceLocations().then(setSavedLocations);
  }, []);

  // Load action items for the open session so the tab badge + panel stay in sync.
  React.useEffect(() => {
    if (!open || !initial) return;
    const sessionId = initial.id;
    let live = true;
    listActionItemsForSession(sessionId)
      .then((items) => {
        if (live) setLoadedActionItems({ sessionId, items });
      })
      .catch(() => {
        if (live) setLoadedActionItems({ sessionId, items: [] });
      });
    return () => {
      live = false;
    };
  }, [open, initial]);

  useResetOnOpen(open, [initial, services, timezone], () => {
    setForm(initial ? toForm(initial, services, timezone) : emptyForm(services));
    setConflict(null);
  });

  const startISO = React.useMemo(() => {
    return zonedWallToISO(form.date, form.time, timezone);
  }, [form.date, form.time, timezone]);

  const endISO = React.useMemo(() => {
    return new Date(Date.parse(startISO) + form.durationMin * 60000).toISOString();
  }, [startISO, form.durationMin]);

  React.useEffect(() => {
    if (!open) return;
    let live = true;
    findConflict({ startISO, endISO, id: initial?.id })
      .then((c) => {
        if (live) setConflict(c);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [open, startISO, endISO, initial?.id]);

  const save = async () => {
    setBusy(true);
    try {
      // Drop the address entirely if the session went online — keeps the
      // SessionItem clean and avoids carrying stale physical-address data.
      const addressOnSave =
        form.locationType === "online" ? undefined : form.address;
      if (isEdit && initial) {
        const next = await updateSession(initial.id, {
          serviceId: form.serviceId,
          startISO,
          endISO,
          capacity: form.capacity,
          status: form.status,
          locationType: form.locationType,
          location: form.location,
          address: addressOnSave,
          notes: form.notes,
        });
        onSaved?.(next);
        toast.success(uiText("ui.session.updated"));
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
          address: addressOnSave,
          recurring: form.recurring,
          notes: form.notes,
        });
        onSaved?.(next);
        toast.success(uiText("ui.session.scheduled"));
      }
      onClose();
    } catch (err) {
      toast.error(uiText("ui.couldn.t.save.session"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  // Internal note saves independently from the Notes & Actions tab (updateSession
  // is a patch merge, so the main Details "Save" stays consistent with this).
  const saveNote = async () => {
    if (!initial) return;
    setSavingNote(true);
    try {
      const next = await updateSession(initial.id, { notes: form.notes });
      onSaved?.(next);
      toast.success(uiText("ui.note.saved"));
    } catch (err) {
      toast.error(uiText("ui.couldn.t.save.note"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSavingNote(false);
    }
  };

  const cancel = async () => {
    if (!initial) return;
    setBusy(true);
    try {
      const next = await cancelSession(initial.id);
      onCancelled?.(next);
      toast.success(uiText("ui.session.cancelled"));
      setConfirmCancel(false);
      onClose();
    } catch (err) {
      toast.error(uiText("ui.couldn.t.cancel.session"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const eyebrow = isView
    ? uiText("ui.session.details")
    : isEdit
      ? uiText("ui.edit.session")
      : uiText("ui.new.session");
  const title = isEdit ? `Session · ${initial?.id}` : uiText("ui.schedule.a.session");

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      eyebrow={eyebrow}
      title={title}
      footer={
        tab === "attendance" || tab === "notes" ? (
          <Button variant="ghost" onClick={onClose}>
            {uiText("ui.close")}</Button>
        ) : isView ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              {uiText("ui.close")}</Button>
            {initial?.status === "scheduled" && (
              <Button
                variant="secondary"
                icon="plus"
                onClick={() => openBookingDrawer({ defaultSessionId: initial.id })}
              >
                {uiText("ui.add.attendee")}</Button>
            )}
            <Button icon="edit" onClick={() => setMode("edit")}>
              {uiText("ui.edit.session")}</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {uiText("ui.cancel")}</Button>
            <Button onClick={save} loading={busy} disabled={!form.serviceId}>
              {isEdit ? uiText("ui.save.changes") : uiText("ui.create.session")}
            </Button>
          </>
        )
      }
    >
      {showTabs && (
        <div className="mb-5">
          <Tabs
            value={tab}
            onChange={(v) => setTab(v as "details" | "notes" | "attendance")}
            tabs={[
              { value: "details", label: uiText("ui.details") },
              {
                value: "notes",
                label:
                  canShowActionItems && openActionCount > 0
                    ? uiText("ui.notes.actions.count", { count: openActionCount })
                    : canShowActionItems
                      ? uiText("ui.notes.actions")
                      : uiText("ui.internal.notes"),
              },
              ...(canShowAttendance
                ? [{ value: "attendance", label: uiText("ui.attendance") }]
                : []),
            ]}
          />
        </div>
      )}

      {tab === "notes" && initial ? (
        <div className="flex flex-col gap-6">
          <div>
            <h4 className="text-[13px] font-semibold text-ink">{uiText("ui.internal.note")}</h4>
            <p className="text-micro text-ink-3 mt-0.5 mb-2">
              {uiText("ui.only.visible.to.you.session.specific.reminders.or.attendee.context")}</p>
            <Textarea
              value={form.notes}
              rows={3}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <div className="mt-2 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                icon="check"
                onClick={saveNote}
                loading={savingNote}
              >
                {uiText("ui.save.note")}</Button>
            </div>
          </div>

          {canShowActionItems && (
            <div className="border-t border-line-soft pt-5">
              <SessionActionItems
                sessionId={initial.id}
                items={actionItems}
                onChange={setActionItems}
                loading={actionItemsLoading}
              />
            </div>
          )}
        </div>
      ) : tab === "attendance" && initial ? (
        <AttendanceTab sessionId={initial.id} />
      ) : (
      <fieldset disabled={isView} className="flex flex-col gap-5 disabled:opacity-90">
        <Field label={uiText("ui.service")} required>
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
                // Inherit the service's default address (if any). When the new
                // service has none, clear — the operator can re-attach manually.
                address: svc?.address ? { ...svc.address } : undefined,
              });
            }}
            options={services.map((s) => ({ value: s.id, label: s.name }))}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={uiText("ui.date")} required>
            <Input
              type="date"
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
              value={form.recurring}
              onChange={(e) =>
                setForm({ ...form, recurring: e.target.value as Recurring })
              }
              options={[
                { value: "one-off", label: uiText("ui.one.off") },
                { value: "weekly", label: uiText("ui.weekly") },
                ...(dataSource === "mock" || form.recurring === "custom"
                  ? [{ value: "custom", label: uiText("ui.custom") }]
                  : []),
              ]}
            />
          </Field>
        </div>

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
              onClick={() => setConfirmCancel(true)}
              disabled={busy}
            >
              {uiText("ui.cancel.session")}</Button>
          </div>
        )}
      </fieldset>
      )}

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => !busy && setConfirmCancel(false)}
        onConfirm={cancel}
        title={uiText("ui.cancel.this.session")}
        description={uiText("ui.all.attendees.will.be.notified.and.their.bookings.marked.cancelled")}
        confirmLabel={uiText("ui.cancel.session")}
        cancelLabel={uiText("ui.keep.session")}
        destructive
        busy={busy}
      />
    </DrawerShell>
  );
}
