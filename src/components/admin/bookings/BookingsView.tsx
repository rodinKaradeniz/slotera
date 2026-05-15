"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { StatusAccordion } from "./StatusAccordion";
import type { BookingRowData } from "./BookingRow";
import { listBookings } from "@/services/bookings.service";
import { listClients } from "@/services/clients.service";
import { listSessions } from "@/services/sessions.service";
import { listServices } from "@/services/services.service";
import { useDrawers } from "@/components/drawers/DrawersProvider";
import type { Booking } from "@/types/booking";
import type { Client } from "@/types/client";
import type { Service } from "@/types/service";
import type { SessionItem } from "@/types/session";
import type { BookingStatus } from "@/types/common";

const STATUS_ORDER: BookingStatus[] = ["pending", "confirmed", "completed", "cancelled"];

function whenFromSession(s: SessionItem): string {
  const start = new Date(s.startISO);
  return `${start.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  })} · ${s.startISO.slice(11, 16)}`;
}

export function BookingsView() {
  const { openBookingDrawer } = useDrawers();
  const [bookings, setBookings] = React.useState<Booking[] | null>(null);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [sessions, setSessions] = React.useState<SessionItem[]>([]);
  const [services, setServices] = React.useState<Service[]>([]);
  const [query, setQuery] = React.useState("");
  const [serviceFilter, setServiceFilter] = React.useState("all");
  const [reload, setReload] = React.useState(0);

  React.useEffect(() => {
    Promise.all([
      listBookings(),
      listClients(),
      listSessions(),
      listServices(),
    ]).then(([b, c, s, sv]) => {
      setBookings(b);
      setClients(c);
      setSessions(s);
      setServices(sv);
    });
  }, [reload]);

  const rows = React.useMemo<BookingRowData[]>(() => {
    if (!bookings) return [];
    return bookings.map((b) => {
      const client = clients.find((c) => c.id === b.clientId);
      const session = sessions.find((s) => s.id === b.sessionId);
      const service = services.find((s) => s.id === session?.serviceId);
      return {
        id: b.id,
        booking: b,
        clientName: client?.name ?? "Unknown client",
        clientCompany: client?.company,
        serviceName: service?.name ?? "Service",
        when: session ? whenFromSession(session) : "—",
      };
    });
  }, [bookings, clients, sessions, services]);

  const filtered = rows.filter((r) => {
    const q = query.trim().toLowerCase();
    const qOk = !q ||
      r.clientName.toLowerCase().includes(q) ||
      r.serviceName.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q);
    const session = sessions.find((s) => s.id === r.booking.sessionId);
    const sOk =
      serviceFilter === "all" || session?.serviceId === serviceFilter;
    return qOk && sOk;
  });

  const byStatus = STATUS_ORDER.reduce<Record<BookingStatus, BookingRowData[]>>(
    (acc, s) => {
      acc[s] = filtered.filter((r) => r.booking.status === s);
      return acc;
    },
    { pending: [], confirmed: [], completed: [], cancelled: [], noshow: [] },
  );

  return (
    <div className="max-w-[1200px] mx-auto">
      <PageHeader
        eyebrow="Operations"
        title="Bookings"
        sub={bookings ? `${bookings.length} total` : "Loading…"}
        actions={
          <>
            <Button variant="secondary" size="md" icon="download">
              Export
            </Button>
            <Button
              variant="primary"
              size="md"
              icon="plus"
              onClick={() =>
                openBookingDrawer({
                  onSaved: () => setReload((k) => k + 1),
                })
              }
            >
              New booking
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex-1 min-w-[220px]">
          <Input
            icon="search"
            placeholder="Search by client, service, or ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="w-48">
          <Select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            options={[
              { value: "all", label: "All services" },
              ...services.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </div>
      </div>

      {!bookings ? (
        <LoadingRows count={4} />
      ) : (
        <div className="flex flex-col gap-3">
          {STATUS_ORDER.map((s, i) => (
            <StatusAccordion
              key={s}
              status={s}
              rows={byStatus[s]}
              defaultOpen={i === 0}
              onRowClick={(r) =>
                openBookingDrawer({
                  initial: r.booking,
                  onSaved: () => setReload((k) => k + 1),
                  onCancelled: () => setReload((k) => k + 1),
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
