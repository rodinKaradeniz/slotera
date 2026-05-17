"use client";

import * as React from "react";
import { DrawerShell } from "@/components/ui/DrawerShell";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  createBooking,
  updateBooking,
  cancelBooking,
} from "@/services/bookings.service";
import { listSessions } from "@/services/sessions.service";
import { listClients } from "@/services/clients.service";
import { listServices } from "@/services/services.service";
import type { Booking } from "@/types/booking";
import type { Client } from "@/types/client";
import type { Service } from "@/types/service";
import type { SessionItem } from "@/types/session";
import type { BookingStatus, PaymentStatus } from "@/types/common";

export type BookingDrawerMode = "view" | "edit";

export type BookingDrawerProps = {
  open: boolean;
  onClose: () => void;
  initial?: Booking | null;
  mode?: BookingDrawerMode;
  defaultSessionId?: string;
  defaultClientId?: string;
  onSaved?: (b: Booking) => void;
  onCancelled?: (b: Booking) => void;
};

type FormState = {
  clientId: string;
  sessionId: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  amountCents: number;
  notes: string;
};

function emptyForm(opts: { sessionId?: string; clientId?: string } = {}): FormState {
  return {
    clientId: opts.clientId ?? "",
    sessionId: opts.sessionId ?? "",
    status: "pending",
    paymentStatus: "pending",
    amountCents: 0,
    notes: "",
  };
}

export function BookingDrawer({
  open,
  onClose,
  initial,
  mode: modeProp = "edit",
  defaultSessionId,
  defaultClientId,
  onSaved,
  onCancelled,
}: BookingDrawerProps) {
  const isEdit = !!initial;
  const [mode, setMode] = React.useState<BookingDrawerMode>(modeProp);
  const isView = mode === "view" && isEdit;
  const [clients, setClients] = React.useState<Client[]>([]);
  const [sessions, setSessions] = React.useState<SessionItem[]>([]);
  const [services, setServices] = React.useState<Service[]>([]);
  const [form, setForm] = React.useState<FormState>(() =>
    emptyForm({ sessionId: defaultSessionId, clientId: defaultClientId }),
  );
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) setMode(modeProp);
  }, [open, modeProp]);

  React.useEffect(() => {
    Promise.all([listClients(), listSessions(), listServices()]).then(
      ([c, s, sv]) => {
        setClients(c);
        setSessions(s);
        setServices(sv);
      },
    );
  }, []);

  React.useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        clientId: initial.clientId,
        sessionId: initial.sessionId,
        status: initial.status,
        paymentStatus: initial.paymentStatus,
        amountCents: initial.amountCents,
        notes: initial.notes ?? "",
      });
    } else {
      setForm(emptyForm({ sessionId: defaultSessionId, clientId: defaultClientId }));
    }
  }, [open, initial, defaultSessionId, defaultClientId]);

  const selectedSession = sessions.find((s) => s.id === form.sessionId);
  const selectedService = services.find((s) => s.id === selectedSession?.serviceId);

  React.useEffect(() => {
    if (!initial && selectedService) {
      setForm((f) =>
        f.amountCents === 0 ? { ...f, amountCents: selectedService.priceCents } : f,
      );
    }
  }, [selectedService, initial]);

  const save = async () => {
    setBusy(true);
    try {
      if (isEdit && initial) {
        const next = await updateBooking(initial.id, {
          clientId: form.clientId,
          sessionId: form.sessionId,
          status: form.status,
          paymentStatus: form.paymentStatus,
          amountCents: form.amountCents,
          currency: initial.currency,
          notes: form.notes,
        });
        onSaved?.(next);
      } else {
        const next = await createBooking({
          clientId: form.clientId,
          sessionId: form.sessionId,
          status: form.status,
          paymentStatus: form.paymentStatus,
          amountCents: form.amountCents,
          currency: selectedService?.currency ?? "GBP",
          notes: form.notes,
        });
        onSaved?.(next);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!initial) return;
    if (!confirm("Cancel this booking?")) return;
    setBusy(true);
    try {
      const next = await cancelBooking(initial.id);
      onCancelled?.(next);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const ready = !!form.clientId && !!form.sessionId;

  const eyebrow = isView
    ? "Booking details"
    : isEdit
      ? "Edit booking"
      : "New booking";
  const title = isEdit ? `Booking ${initial?.id}` : "Create a booking";

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      eyebrow={eyebrow}
      title={title}
      footer={
        isView ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button icon="edit" onClick={() => setMode("edit")}>
              Edit booking
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Close
            </Button>
            <Button onClick={save} loading={busy} disabled={!ready}>
              {isEdit ? "Save changes" : "Create booking"}
            </Button>
          </>
        )
      }
    >
      <fieldset disabled={isView} className="flex flex-col gap-5 disabled:opacity-90">
        <Field label="Client" required>
          <Select
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            options={[
              { value: "", label: "Select a client…" },
              ...clients.map((c) => ({ value: c.id, label: `${c.name} · ${c.email}` })),
            ]}
          />
        </Field>

        <Field label="Session" required>
          <Select
            value={form.sessionId}
            onChange={(e) => setForm({ ...form, sessionId: e.target.value })}
            options={[
              { value: "", label: "Select a session…" },
              ...sessions.map((s) => {
                const svc = services.find((x) => x.id === s.serviceId);
                const start = new Date(s.startISO);
                const when = `${start.toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })} · ${start.toISOString().slice(11, 16)}`;
                return {
                  value: s.id,
                  label: `${svc?.name ?? "Service"} · ${when}`,
                };
              }),
            ]}
          />
        </Field>

        {selectedSession && (
          <div className="rounded-md bg-surface-warm border border-line-soft px-4 py-3 text-small">
            {selectedSession.capacity === 1
              ? "1:1 session"
              : `Up to ${selectedSession.capacity} · ${
                  selectedSession.capacity - selectedSession.bookedCount
                } spots left`}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Booking status">
            <Select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as BookingStatus })
              }
              options={[
                { value: "pending", label: "Pending" },
                { value: "confirmed", label: "Confirmed" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
                { value: "noshow", label: "No-show" },
              ]}
            />
          </Field>
          <Field label="Payment status">
            <Select
              value={form.paymentStatus}
              onChange={(e) =>
                setForm({
                  ...form,
                  paymentStatus: e.target.value as PaymentStatus,
                })
              }
              options={[
                { value: "pending", label: "Pending" },
                { value: "paid", label: "Paid" },
                { value: "refunded", label: "Refunded" },
                { value: "free", label: "Free" },
                { value: "overdue", label: "Overdue" },
              ]}
            />
          </Field>
        </div>

        <Field label="Amount" hint="In the smallest unit (e.g. cents).">
          <Input
            type="number"
            value={String(form.amountCents)}
            onChange={(e) =>
              setForm({ ...form, amountCents: Number(e.target.value) || 0 })
            }
            min={0}
          />
        </Field>

        <Field label="Notes" optional>
          <Textarea
            value={form.notes}
            rows={3}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>

        {isEdit && !isView && (
          <div className="pt-5 border-t border-line-soft flex justify-end">
            <Button
              variant="danger"
              size="sm"
              icon="x"
              onClick={cancel}
              disabled={busy}
            >
              Cancel booking
            </Button>
          </div>
        )}
      </fieldset>
    </DrawerShell>
  );
}
