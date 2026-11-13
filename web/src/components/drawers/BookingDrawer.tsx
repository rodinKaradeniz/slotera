"use client";
import { readLang, localeForLang } from "@/lib/i18n";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { clockIn } from "@/lib/calendar";
import { useWorkspaceTimezone } from "@/lib/use-workspace-timezone";
import { useResetOnOpen } from "@/lib/use-reset-on-open";
import Link from "next/link";
import { DrawerShell } from "@/components/ui/DrawerShell";
import { Icon } from "@/components/ui/Icon";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import {
  createBooking,
  createOperatorBooking,
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
import { dataSource } from "@/lib/env";

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
  /** API mode: recorded in the audit log with the booking. */
  auditReason: string;
};

function emptyForm(opts: { sessionId?: string; clientId?: string } = {}): FormState {
  return {
    clientId: opts.clientId ?? "",
    sessionId: opts.sessionId ?? "",
    status: "pending",
    paymentStatus: "pending",
    amountCents: 0,
    notes: "",
    auditReason: "Booked by the operator on the client's behalf",
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
  const { t: uiText } = useI18n();
  const isEdit = !!initial;
  const [mode, setMode] = React.useState<BookingDrawerMode>(modeProp);
  const isView = mode === "view" && isEdit;
  const { toast } = useToast();
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [sessions, setSessions] = React.useState<SessionItem[]>([]);
  const [services, setServices] = React.useState<Service[]>([]);
  const [form, setForm] = React.useState<FormState>(() =>
    emptyForm({ sessionId: defaultSessionId, clientId: defaultClientId }),
  );
  const [busy, setBusy] = React.useState(false);
  // One key per opened form: a double-click or retry replays, never double-books.
  const [idempotencyKey, setIdempotencyKey] = React.useState(() => crypto.randomUUID());
  const [openedAt, setOpenedAt] = React.useState(0);

  useResetOnOpen(open, [modeProp], () => setMode(modeProp));

  React.useEffect(() => {
    Promise.all([listClients(), listSessions(), listServices()]).then(
      ([c, s, sv]) => {
        setClients(c);
        setSessions(s);
        setServices(sv);
      },
    );
  }, []);

  useResetOnOpen(open, [initial, defaultSessionId, defaultClientId], () => {
    if (initial) {
      setForm({
        clientId: initial.clientId,
        sessionId: initial.sessionId,
        status: initial.status,
        paymentStatus: initial.paymentStatus,
        amountCents: initial.amountCents,
        notes: initial.notes ?? "",
        auditReason: "",
      });
    } else {
      setForm(emptyForm({ sessionId: defaultSessionId, clientId: defaultClientId }));
      setIdempotencyKey(crypto.randomUUID());
      setOpenedAt(Date.now());
    }
  });

  const selectedSession = sessions.find((s) => s.id === form.sessionId);
  const selectedService = services.find((s) => s.id === selectedSession?.serviceId);

  // A new booking starts at the chosen service's price unless an amount was entered.
  const [pricedFrom, setPricedFrom] = React.useState<Service | undefined>(undefined);
  if (!initial && selectedService && selectedService !== pricedFrom) {
    setPricedFrom(selectedService);
    if (form.amountCents === 0) {
      setForm({ ...form, amountCents: selectedService.priceCents });
    }
  }

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
        toast.success(uiText("ui.booking.updated"));
      } else if (dataSource === "api") {
        const next = await createOperatorBooking(
          {
            clientId: form.clientId,
            sessionId: form.sessionId,
            notes: form.notes,
            auditReason: form.auditReason,
          },
          idempotencyKey,
        );
        onSaved?.(next);
        toast.success(uiText("ui.booking.created"));
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
        toast.success(uiText("ui.booking.created"));
      }
      onClose();
    } catch (err) {
      toast.error(uiText("ui.couldn.t.save.booking"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!initial) return;
    setBusy(true);
    try {
      const next = await cancelBooking(initial.id);
      onCancelled?.(next);
      toast.success(uiText("ui.booking.cancelled"));
      setConfirmCancel(false);
      onClose();
    } catch (err) {
      toast.error(uiText("ui.couldn.t.cancel.booking"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const ready =
    !!form.clientId &&
    !!form.sessionId &&
    (dataSource === "mock" || isEdit || !!form.auditReason.trim());
  // API mode books into upcoming, active sessions that still have room.
  const timezone = useWorkspaceTimezone();
  const bookableSessions =
    dataSource === "api" && !isEdit
      ? sessions.filter(
          (s) =>
            new Date(s.startISO).getTime() > openedAt &&
            s.status !== "cancelled" &&
            s.bookedCount < s.capacity,
        )
      : sessions;

  const eyebrow = isView
    ? uiText("ui.booking.details")
    : isEdit
      ? uiText("ui.edit.booking")
      : uiText("ui.new.booking");
  const title = isEdit ? `Booking ${initial?.id}` : uiText("ui.create.a.booking");

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
              {uiText("ui.close")}</Button>
            {dataSource === "mock" && (
              <Button icon="edit" onClick={() => setMode("edit")}>
                {uiText("ui.edit.booking")}</Button>
            )}
          </>
        ) : (
          <>
            {isEdit && (
              <Button
                variant="danger"
                size="sm"
                icon="x"
                onClick={() => setConfirmCancel(true)}
                disabled={busy}
                className="mr-auto"
              >
                {uiText("ui.cancel.booking")}</Button>
            )}
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {uiText("ui.close")}</Button>
            <Button onClick={save} loading={busy} disabled={!ready}>
              {isEdit ? uiText("ui.save.changes") : uiText("ui.create.booking")}
            </Button>
          </>
        )
      }
    >
      <fieldset disabled={isView} className="flex flex-col gap-5 disabled:opacity-90">
        <Field label={uiText("ui.client")} required>
          <Select
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            options={[
              { value: "", label: uiText("ui.select.a.client") },
              ...clients.map((c) => ({ value: c.id, label: `${c.name} · ${c.email}` })),
            ]}
          />
        </Field>

        <Field label={uiText("ui.session")} required>
          <Select
            value={form.sessionId}
            onChange={(e) => setForm({ ...form, sessionId: e.target.value })}
            options={[
              { value: "", label: uiText("ui.select.a.session") },
              ...bookableSessions.map((s) => {
                const svc = services.find((x) => x.id === s.serviceId);
                const start = new Date(s.startISO);
                const when = `${start.toLocaleDateString(localeForLang(readLang()), {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })} · ${clockIn(s.startISO, timezone)}`;
                return {
                  value: s.id,
                  label: `${svc?.name ?? uiText("ui.service")} · ${when}`,
                };
              }),
            ]}
          />
        </Field>

        {selectedSession && (
          <div className="rounded-md bg-surface-warm border border-line-soft px-4 py-3 text-small">
            {selectedSession.capacity === 1
              ? "1:1 session"
              : uiText("ui.capacity.remaining", { capacity: selectedSession.capacity, count: selectedSession.capacity - selectedSession.bookedCount })}
          </div>
        )}

        {dataSource === "api" && !isEdit && (
          <div className="rounded-md bg-surface-warm border border-line-soft px-4 py-3 text-small">
            {uiText("ui.the.price.and.currency.come.from.the.service.the.booking.starts.pending.until.its.payment.")}</div>
        )}

        {dataSource === "mock" && (
        <div className="grid grid-cols-2 gap-4">
          <Field label={uiText("ui.booking.status")}>
            <Select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as BookingStatus })
              }
              options={[
                { value: "pending", label: uiText("ui.pending") },
                { value: "confirmed", label: uiText("ui.confirmed") },
                { value: "completed", label: uiText("ui.completed") },
                { value: "cancelled", label: uiText("ui.cancelled") },
                { value: "noshow", label: uiText("ui.no.show") },
              ]}
            />
          </Field>
          <Field label={uiText("ui.payment.status")}>
            <Select
              value={form.paymentStatus}
              onChange={(e) =>
                setForm({
                  ...form,
                  paymentStatus: e.target.value as PaymentStatus,
                })
              }
              options={[
                { value: "pending", label: uiText("ui.pending") },
                { value: "paid", label: uiText("ui.paid") },
                { value: "refunded", label: uiText("ui.refunded") },
                { value: "free", label: uiText("ui.free") },
                { value: "overdue", label: uiText("ui.overdue") },
              ]}
            />
          </Field>
        </div>

        )}

        {dataSource === "mock" && (
        <Field label={uiText("ui.amount")} hint={uiText("ui.in.the.smallest.unit.e.g.cents")}>
          <Input
            type="number"
            value={String(form.amountCents)}
            onChange={(e) =>
              setForm({ ...form, amountCents: Number(e.target.value) || 0 })
            }
            min={0}
          />
        </Field>
        )}

        {dataSource === "api" && !isEdit && (
          <Field label={uiText("ui.reason")} required hint={uiText("ui.kept.in.the.audit.log.with.this.booking")}>
            <Input
              value={form.auditReason}
              onChange={(e) => setForm({ ...form, auditReason: e.target.value })}
            />
          </Field>
        )}

        <Field
          label={uiText("ui.booking.note")}
          optional
          hint={uiText("ui.only.visible.to.you.context.for.this.specific.booking")}
        >
          <Textarea
            value={form.notes}
            rows={3}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>

        {isEdit && (
          <div className="pt-1">
            <Link
              href="/booking/manage/demo"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-[13px] text-accent hover:underline"
            >
              <Icon name="eye" size={15} />
              {uiText("ui.view.booking.workspace")}</Link>
            <p className="text-micro text-ink-3 mt-1">
              {uiText("ui.preview.the.post.booking.page.your.client.could.see.demo")}</p>
          </div>
        )}
      </fieldset>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => !busy && setConfirmCancel(false)}
        onConfirm={cancel}
        title={uiText("ui.cancel.this.booking")}
        description={uiText("ui.the.client.will.be.marked.cancelled.and.refunded.they.keep.visibility.into.the.original.se")}
        confirmLabel={uiText("ui.cancel.booking")}
        cancelLabel={uiText("ui.keep.booking")}
        destructive
        busy={busy}
      />
    </DrawerShell>
  );
}
