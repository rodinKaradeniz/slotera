"use client";

import * as React from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { SegGroup } from "@/components/ui/SegGroup";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  listBookingsBySession,
  setBookingAttendance,
} from "@/services/bookings.service";
import { listClients } from "@/services/clients.service";
import type { Booking, BookingAttendance } from "@/types/booking";
import type { Client } from "@/types/client";

type Props = {
  sessionId: string;
};

type Row = {
  booking: Booking;
  client: Client | undefined;
};

const ATTENDANCE_OPTIONS = [
  { value: "present" as BookingAttendance, label: "Present" },
  { value: "late" as BookingAttendance, label: "Late" },
  { value: "absent" as BookingAttendance, label: "Absent" },
];

/**
 * Renders inside SessionDrawer's Attendance tab. Only shown when capacity > 1.
 * Cancelled bookings are filtered out — attendance only makes sense for the
 * people who were expected.
 */
export function AttendanceTab({ sessionId }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [busyIds, setBusyIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    let live = true;
    Promise.all([listBookingsBySession(sessionId), listClients()]).then(
      ([bookings, clients]) => {
        if (!live) return;
        const clientById = new Map(clients.map((c) => [c.id, c]));
        const filtered = bookings
          .filter((b) => b.status !== "cancelled")
          .map<Row>((b) => ({ booking: b, client: clientById.get(b.clientId) }));
        setRows(filtered);
      },
    );
    return () => {
      live = false;
    };
  }, [sessionId]);

  const update = async (id: string, attendance: BookingAttendance) => {
    if (!rows) return;
    setBusyIds((prev) => new Set(prev).add(id));
    // Optimistic — flip the row immediately so the SegGroup feels live.
    const snapshot = rows;
    setRows(
      rows.map((r) =>
        r.booking.id === id
          ? { ...r, booking: { ...r.booking, attendance } }
          : r,
      ),
    );
    try {
      await setBookingAttendance(id, attendance);
    } catch (err) {
      // Roll back on failure.
      setRows(snapshot);
      toast.error("Couldn't update attendance", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const markAllPresent = async () => {
    if (!rows) return;
    const targets = rows.filter((r) => !r.booking.attendance);
    if (targets.length === 0) return;
    const snapshot = rows;
    setRows(
      rows.map((r) =>
        r.booking.attendance
          ? r
          : { ...r, booking: { ...r.booking, attendance: "present" } },
      ),
    );
    setBusyIds(new Set(targets.map((t) => t.booking.id)));
    try {
      await Promise.all(
        targets.map((t) => setBookingAttendance(t.booking.id, "present")),
      );
      toast.success(`Marked ${targets.length} attendee${targets.length === 1 ? "" : "s"} present`);
    } catch (err) {
      setRows(snapshot);
      toast.error("Couldn't mark all present", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusyIds(new Set());
    }
  };

  if (rows === null) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton h={32} />
        <Skeleton h={48} />
        <Skeleton h={48} />
        <Skeleton h={48} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line p-6 text-small text-center">
        No bookings to mark. Once clients reserve this session, they&apos;ll
        appear here.
      </div>
    );
  }

  const marked = rows.filter((r) => r.booking.attendance).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-small">
          <span className="font-medium text-ink">{marked}</span>
          <span className="text-ink-3"> / {rows.length} marked</span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon="check"
          onClick={markAllPresent}
          disabled={marked === rows.length || busyIds.size > 0}
        >
          Mark all present
        </Button>
      </div>

      <div className="flex flex-col rounded-md border border-line bg-surface overflow-hidden">
        {rows.map((r, i) => {
          const isBusy = busyIds.has(r.booking.id);
          return (
            <div
              key={r.booking.id}
              className={
                "flex items-center gap-3 px-4 py-3" +
                (i < rows.length - 1 ? " border-b border-line-soft" : "")
              }
            >
              <Avatar name={r.client?.name ?? "Client"} size={32} />
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium text-ink truncate">
                  {r.client?.name ?? "Unknown client"}
                </div>
                {r.client?.company && (
                  <div className="text-micro text-ink-3 truncate">
                    {r.client.company}
                  </div>
                )}
              </div>
              <SegGroup<BookingAttendance>
                size="sm"
                value={r.booking.attendance ?? ("" as BookingAttendance)}
                onChange={(v) => update(r.booking.id, v)}
                options={ATTENDANCE_OPTIONS}
                className={isBusy ? "opacity-60 pointer-events-none" : undefined}
              />
            </div>
          );
        })}
      </div>

      <p className="text-micro text-ink-3">
        Attendance is recorded per attendee and saved as you mark each row.
      </p>
    </div>
  );
}
