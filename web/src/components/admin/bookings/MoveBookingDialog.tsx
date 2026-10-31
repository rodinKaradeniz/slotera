"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { moveBooking } from "@/services/bookings.service";
import { getSession, listSessions } from "@/services/sessions.service";
import { clockIn } from "@/lib/calendar";
import { useWorkspaceTimezone } from "@/lib/use-workspace-timezone";
import { useResetOnOpen } from "@/lib/use-reset-on-open";
import type { Booking } from "@/types/booking";
import type { SessionItem } from "@/types/session";

type Props = {
  open: boolean;
  onClose: () => void;
  booking: Booking | null;
  onMoved: (booking: Booking) => void;
};

const DEFAULT_REASON = "Moved at the provider's request.";

function when(session: SessionItem, timezone: string): string {
  const start = new Date(session.startISO);
  const day = start.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const seats =
    session.capacity > 1 ? ` · ${session.capacity - session.bookedCount} spots left` : "";
  return `${day} · ${clockIn(session.startISO, timezone)}${seats}`;
}

/**
 * Real app only: moves a booking to another upcoming session of the same service that
 * still has room. For a 1:1 at a new time, add the session in the Calendar first.
 */
export function MoveBookingDialog({ open, onClose, booking, onMoved }: Props) {
  const timezone = useWorkspaceTimezone();
  const { toast } = useToast();
  const [sessionId, setSessionId] = React.useState("");
  const [reason, setReason] = React.useState(DEFAULT_REASON);
  const [busy, setBusy] = React.useState(false);
  // One key per opened dialog: a double-click or retry replays, never moves twice.
  const [idempotencyKey, setIdempotencyKey] = React.useState(() => crypto.randomUUID());
  const [loaded, setLoaded] = React.useState<{
    bookingId: string;
    sessions: SessionItem[];
  } | null>(null);

  useResetOnOpen(open, [booking?.id], () => {
    setSessionId("");
    setReason(DEFAULT_REASON);
    setIdempotencyKey(crypto.randomUUID());
  });

  const bookingId = booking?.id;
  const currentSessionId = booking?.sessionId;
  React.useEffect(() => {
    if (!open || !bookingId || !currentSessionId) return;
    let live = true;
    Promise.all([getSession(currentSessionId), listSessions()])
      .then(([current, all]) => {
        if (!live) return;
        const now = Date.now();
        setLoaded({
          bookingId,
          sessions: all.filter(
            (s) =>
              s.id !== currentSessionId &&
              s.serviceId === current?.serviceId &&
              s.status !== "cancelled" &&
              new Date(s.startISO).getTime() > now &&
              s.bookedCount < s.capacity,
          ),
        });
      })
      .catch(() => {
        if (live) setLoaded({ bookingId, sessions: [] });
      });
    return () => {
      live = false;
    };
  }, [open, bookingId, currentSessionId]);

  const candidates = loaded && loaded.bookingId === bookingId ? loaded.sessions : null;

  const submit = async () => {
    if (!booking || !sessionId || !reason.trim()) return;
    setBusy(true);
    try {
      const next = await moveBooking(
        booking.id,
        { sessionId, auditReason: reason },
        idempotencyKey,
      );
      toast.success("Booking moved", {
        description: "Clients who booked online are emailed the new time.",
      });
      onMoved(next);
      onClose();
    } catch (error) {
      toast.error("Couldn't move the booking", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title="Move to another session"
      description="Choose an upcoming session of the same service that has room."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            loading={busy}
            disabled={!sessionId || !reason.trim() || busy}
          >
            Move booking
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="New session"
          required
          hint={
            candidates && candidates.length === 0
              ? "No other upcoming session of this service has room. Add one in the Calendar first."
              : undefined
          }
        >
          <Select
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
            options={[
              {
                value: "",
                label: candidates === null ? "Loading sessions…" : "Select a session…",
              },
              ...(candidates ?? []).map((s) => ({ value: s.id, label: when(s, timezone) })),
            ]}
          />
        </Field>
        <Field label="Reason (recorded in the audit log)" required>
          <Input value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
