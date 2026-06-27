"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useSetCrumbs } from "@/components/layout/PageMeta";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Tabs } from "@/components/ui/Tabs";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CardHead } from "@/components/shared/CardHead";
import { DetailLine } from "@/components/shared/DetailLine";
import { Stat } from "@/components/shared/Stat";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { ClientNotes } from "@/components/admin/clients/ClientNotes";
import { plural } from "@/lib/text";
import { useDrawers } from "@/components/drawers/DrawersProvider";
import { getClient } from "@/services/clients.service";
import { listBookingsByClient } from "@/services/bookings.service";
import { listSessions } from "@/services/sessions.service";
import { listServices } from "@/services/services.service";
import { gbp } from "@/lib/money";
import { fmtDate } from "@/lib/time";
import type { Client } from "@/types/client";
import type { Booking } from "@/types/booking";
import type { Service } from "@/types/service";
import type { SessionItem } from "@/types/session";

type Tab = "overview" | "notes";

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { openBookingDrawer } = useDrawers();
  const [client, setClient] = React.useState<Client | null>(null);
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [sessions, setSessions] = React.useState<SessionItem[]>([]);
  const [services, setServices] = React.useState<Service[]>([]);
  const [tab, setTab] = React.useState<Tab>("overview");
  const [reload, setReload] = React.useState(0);

  React.useEffect(() => {
    if (!params?.id) return;
    let live = true;
    Promise.all([
      getClient(params.id),
      listBookingsByClient(params.id),
      listSessions(),
      listServices(),
    ]).then(([c, b, s, sv]) => {
      if (!live) return;
      setClient(c);
      setBookings(b);
      setSessions(s);
      setServices(sv);
    });
    return () => {
      live = false;
    };
  }, [params?.id, reload]);

  useSetCrumbs([
    { label: "Clients", href: "/admin/clients" },
    { label: client?.name ?? "Detail" },
  ]);

  return (
    <PageContainer>
      {!client ? (
        <LoadingRows count={3} />
      ) : (
        <>
          <button
            type="button"
            onClick={() => router.push("/admin/clients")}
            className="text-small text-ink-3 hover:text-ink mb-4 inline-flex items-center gap-1"
          >
            ← All clients
          </button>

          <PageHeader
            eyebrow="Client"
            title={
              <span className="inline-flex items-center gap-4">
                <Avatar name={client.name} size={48} />
                {client.name}
              </span>
            }
            description={
              client.role
                ? `${client.role} · ${client.company ?? client.email}`
                : (client.company ?? client.email)
            }
            meta={
              <span className="inline-flex items-center gap-2 flex-wrap">
                <StatusBadge kind="client" status={client.tag} />
                <span aria-hidden>·</span>
                <span>Since {fmtDate(new Date(client.joinedISO))}</span>
                <span aria-hidden>·</span>
                <span>{plural(client.totalBookings, "booking")}</span>
              </span>
            }
            actions={
              <>
                <Button variant="secondary" size="md" icon="mail">
                  Email
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  icon="plus"
                  onClick={() =>
                    openBookingDrawer({
                      defaultClientId: client.id,
                      onSaved: () => setReload((k) => k + 1),
                    })
                  }
                >
                  Book a session
                </Button>
              </>
            }
          />

          <Card padded={false} className="mb-4">
            <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-line-soft">
              <PadStat label="Total bookings" value={String(client.totalBookings)} />
              <PadStat label="Completed" value={String(client.completedBookings)} />
              <PadStat label="Cancelled" value={String(client.cancelledBookings)} />
              <PadStat label="Total spent" value={gbp(client.totalSpentCents)} />
              <PadStat
                label="Avg per session"
                value={
                  client.completedBookings > 0
                    ? gbp(Math.round(client.totalSpentCents / client.completedBookings))
                    : "—"
                }
              />
            </div>
          </Card>

          <div className="mb-5">
            <Tabs
              value={tab}
              onChange={(v) => setTab(v as Tab)}
              tabs={[
                { value: "overview", label: "Overview" },
                { value: "notes", label: "Notes" },
              ]}
            />
          </div>

          {tab === "overview" ? (
            <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
              <Card padded={false}>
                <CardHead
                  title="Recent bookings"
                  right={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        router.push(`/admin/bookings?client=${client.id}`)
                      }
                    >
                      View all bookings
                    </Button>
                  }
                />
                {bookings.length === 0 ? (
                  <div className="px-5 py-8 text-small text-center">
                    No bookings yet.
                  </div>
                ) : (
                  bookings.map((b) => {
                    const session = sessions.find((s) => s.id === b.sessionId);
                    const service = services.find((s) => s.id === session?.serviceId);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => router.push(`/admin/bookings/${b.id}`)}
                        className="w-full grid grid-cols-[2fr_2fr_1fr_auto] items-center gap-4 px-5 py-3.5 border-b border-line-soft last:border-b-0 hover:bg-surface-warm text-left"
                      >
                        <div className="text-[14px] text-ink truncate">
                          {service?.name ?? "Service"}
                        </div>
                        <div className="text-small whitespace-nowrap">
                          {session
                            ? `${fmtDate(new Date(session.startISO), "short")} · ${session.startISO.slice(11, 16)}`
                            : "—"}
                        </div>
                        <div className="text-[14px] font-medium text-ink whitespace-nowrap">
                          {b.amountCents === 0 ? "Free" : gbp(b.amountCents)}
                        </div>
                        <StatusBadge kind="booking" status={b.status} />
                      </button>
                    );
                  })
                )}
              </Card>

              <Card padded={false}>
                <CardHead title="Contact info" />
                <div className="p-2">
                  <DetailLine icon="mail" label="Email" value={client.email} />
                  {client.phone && (
                    <DetailLine icon="phone" label="Phone" value={client.phone} />
                  )}
                  {client.company && (
                    <DetailLine
                      icon="building"
                      label="Company"
                      value={client.company}
                    />
                  )}
                  {client.timezone && (
                    <DetailLine
                      icon="globe"
                      label="Timezone"
                      value={client.timezone}
                    />
                  )}
                  {client.address && (
                    <DetailLine icon="map-pin" label="Address" value={client.address} />
                  )}
                  {client.vatId && (
                    <DetailLine icon="file" label="VAT ID" value={client.vatId} />
                  )}
                </div>
              </Card>
            </div>
          ) : (
            <ClientNotes clientId={client.id} />
          )}
        </>
      )}
    </PageContainer>
  );
}

function PadStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-5">
      <Stat label={label} value={value} />
    </div>
  );
}
