"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { clockIn } from "@/lib/calendar";
import { useWorkspaceTimezone } from "@/lib/use-workspace-timezone";
import { plural } from "@/lib/text";
import { useLoad } from "@/lib/use-load";
import { LoadError } from "@/components/shared/LoadError";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
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
import type { SessionItem } from "@/types/session";
import type { BookingStatus } from "@/types/common";
import { dataSource } from "@/lib/env";
import { toCsv, downloadText } from "@/lib/csv";

const STATUS_ORDER: BookingStatus[] = [
  "pending",
  "confirmed",
  "completed",
  "noshow",
  "cancelled",
];

const NONE: never[] = [];

async function loadAll() {
  const [bookings, clients, sessions, services] = await Promise.all([
    listBookings(),
    listClients(),
    listSessions(),
    listServices(),
  ]);
  return { bookings, clients, sessions, services };
}

function whenFromSession(s: SessionItem, timezone: string): string {
  const start = new Date(s.startISO);
  return `${start.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  })} · ${clockIn(s.startISO, timezone)}`;
}

export function BookingsView() {
  const timezone = useWorkspaceTimezone();
  const { openBookingDrawer } = useDrawers();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientFilterId = searchParams.get("client");
  const { data, error, reload } = useLoad(loadAll);
  const bookings = data?.bookings ?? null;
  const clients = data?.clients ?? NONE;
  const sessions = data?.sessions ?? NONE;
  const services = data?.services ?? NONE;
  const [query, setQuery] = React.useState("");
  const [serviceFilter, setServiceFilter] = React.useState("all");

  const clientById = React.useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const sessionById = React.useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);
  const serviceById = React.useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

  const clientFilter = clientFilterId ? (clientById.get(clientFilterId) ?? null) : null;

  const clearClientFilter = () => router.replace("/admin/bookings");

  const rows = React.useMemo<BookingRowData[]>(() => {
    if (!bookings) return [];
    return bookings.map((b) => {
      const client = clientById.get(b.clientId);
      const session = sessionById.get(b.sessionId);
      const service = session ? serviceById.get(session.serviceId) : undefined;
      return {
        id: b.id,
        booking: b,
        clientName: client?.name ?? "Unknown client",
        clientCompany: client?.company,
        serviceName: service?.name ?? "Service",
        when: session ? whenFromSession(session, timezone) : "—",
        time: session ? clockIn(session.startISO, timezone) : "—",
      };
    });
  }, [bookings, clientById, sessionById, serviceById, timezone]);

  const filtered = rows.filter((r) => {
    const q = query.trim().toLowerCase();
    const qOk = !q ||
      r.clientName.toLowerCase().includes(q) ||
      r.serviceName.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q);
    const session = sessionById.get(r.booking.sessionId);
    const sOk =
      serviceFilter === "all" || session?.serviceId === serviceFilter;
    const cOk = !clientFilterId || r.booking.clientId === clientFilterId;
    return qOk && sOk && cOk;
  });

  const exportCsv = () => {
    const text = toCsv(filtered, [
      { header: "Reference", value: (r) => r.booking.reference ?? r.id },
      { header: "Client", value: (r) => r.clientName },
      { header: "Service", value: (r) => r.serviceName },
      {
        header: "Starts (UTC)",
        value: (r) => sessionById.get(r.booking.sessionId)?.startISO ?? "",
      },
      { header: "Status", value: (r) => r.booking.status },
      { header: "Payment", value: (r) => r.booking.paymentStatus },
      { header: "Amount", value: (r) => (r.booking.amountCents / 100).toFixed(2) },
      { header: "Currency", value: (r) => r.booking.currency },
    ]);
    downloadText(`slotera-bookings-${new Date().toISOString().slice(0, 10)}.csv`, text);
  };

  const byStatus = STATUS_ORDER.reduce<Record<BookingStatus, BookingRowData[]>>(
    (acc, s) => {
      acc[s] = filtered.filter((r) => r.booking.status === s);
      return acc;
    },
    { pending: [], confirmed: [], completed: [], cancelled: [], noshow: [] },
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Operations"
        title="Bookings"
        description="All client bookings across 1:1 calls, group classes and workshops."
        meta={
          bookings
            ? `${plural(bookings.length, "booking")} · ${
                bookings.filter((b) => b.paymentStatus === "pending").length
              } pending payment`
            : "Loading…"
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              icon="download"
              onClick={exportCsv}
              disabled={filtered.length === 0}
            >
              Export
            </Button>
            <Button
              variant="primary"
              size="md"
              icon="plus"
              onClick={() =>
                openBookingDrawer({
                  onSaved: reload,
                })
              }
            >
              New booking
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
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

      {clientFilterId && (
        <div className="flex items-center gap-2 mb-6 -mt-2">
          <span className="text-small text-ink-3">Filtered by client:</span>
          <button
            type="button"
            onClick={clearClientFilter}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-warm border border-line px-3 py-1 text-[13px] text-ink hover:bg-paper-2"
          >
            {clientFilter?.name ?? clientFilterId}
            <Icon name="x" size={13} />
          </button>
        </div>
      )}

      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !bookings ? (
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
                  mode: dataSource === "api" ? "view" : "edit",
                  onSaved: reload,
                  onCancelled: reload,
                })
              }
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
