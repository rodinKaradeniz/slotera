"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useSetCrumbs } from "@/components/layout/PageMeta";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CardHead } from "@/components/shared/CardHead";
import { DetailLine } from "@/components/shared/DetailLine";
import { Stat } from "@/components/shared/Stat";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { useDrawers } from "@/components/drawers/DrawersProvider";
import { getBooking } from "@/services/bookings.service";
import { getSession } from "@/services/sessions.service";
import { getService } from "@/services/services.service";
import { getClient } from "@/services/clients.service";
import { gbp } from "@/lib/money";
import { fmtDate } from "@/lib/time";
import { LOC_TYPE_META } from "@/lib/status-maps";
import type { Booking } from "@/types/booking";
import type { Client } from "@/types/client";
import type { Service } from "@/types/service";
import type { SessionItem } from "@/types/session";

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { openBookingDrawer } = useDrawers();
  const [booking, setBooking] = React.useState<Booking | null>(null);
  const [client, setClient] = React.useState<Client | null>(null);
  const [session, setSession] = React.useState<SessionItem | null>(null);
  const [service, setService] = React.useState<Service | null>(null);
  const [reload, setReload] = React.useState(0);

  React.useEffect(() => {
    if (!params?.id) return;
    let live = true;
    getBooking(params.id).then(async (b) => {
      if (!live) return;
      setBooking(b);
      if (!b) return;
      const [cl, ss] = await Promise.all([
        getClient(b.clientId),
        getSession(b.sessionId),
      ]);
      if (!live) return;
      setClient(cl);
      setSession(ss);
      if (ss) {
        const sv = await getService(ss.serviceId);
        if (live) setService(sv);
      }
    });
    return () => {
      live = false;
    };
  }, [params?.id, reload]);

  useSetCrumbs([
    { label: "Bookings", href: "/admin/bookings" },
    { label: booking ? booking.id : "Detail" },
  ]);

  return (
    <>
      <PageContainer>
        {!booking ? (
          <LoadingRows count={3} />
        ) : (
          <>
            <button
              type="button"
              onClick={() => router.push("/admin/bookings")}
              className="text-small text-ink-3 hover:text-ink mb-4 inline-flex items-center gap-1 self-start"
            >
              ← All bookings
            </button>
            <PageHeader
              eyebrow="Booking"
              title={service?.name ?? "Booking"}
              description={
                session
                  ? `${fmtDate(new Date(session.startISO))} · ${session.startISO.slice(11, 16)} – ${session.endISO.slice(11, 16)}`
                  : undefined
              }
              meta={
                <span className="inline-flex items-center gap-2 flex-wrap">
                  <span className="font-mono uppercase tracking-widest text-micro">
                    {booking.id}
                  </span>
                  <span aria-hidden>·</span>
                  <StatusBadge kind="booking" status={booking.status} />
                  <StatusBadge kind="payment" status={booking.paymentStatus} />
                </span>
              }
              actions={
                <>
                  <Button
                    variant="primary"
                    size="md"
                    icon="edit"
                    onClick={() =>
                      openBookingDrawer({
                        initial: booking,
                        onSaved: () => setReload((k) => k + 1),
                        onCancelled: () => router.push("/admin/bookings"),
                      })
                    }
                  >
                    Edit booking
                  </Button>
                  <Button variant="secondary" size="md" icon="download">
                    Invoice PDF
                  </Button>
                </>
              }
            />

            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
              <div className="flex flex-col gap-6">
                <Card padded={false}>
                  <CardHead title="Session" />
                  <div className="p-5">
                    {session ? (
                      <>
                        <div className="text-h3 text-ink" style={{ fontSize: 26 }}>
                          {fmtDate(new Date(session.startISO))}
                        </div>
                        <div className="text-[15px] text-ink-2 mt-1">
                          {session.startISO.slice(11, 16)} – {session.endISO.slice(11, 16)}
                        </div>
                        <div className="mt-4 grid sm:grid-cols-3 gap-3">
                          <Stat label="Capacity" value={`${session.bookedCount} / ${session.capacity}`} />
                          <Stat label="Recurrence" value={session.recurring} />
                          <Stat label="Status" value={session.status} />
                        </div>
                      </>
                    ) : (
                      <p className="text-small">Session details unavailable.</p>
                    )}
                  </div>
                </Card>

                <Card padded={false}>
                  <CardHead title="Location" />
                  <div className="p-2">
                    {session && (
                      <DetailLine
                        icon={LOC_TYPE_META[session.locationType].icon}
                        label={LOC_TYPE_META[session.locationType].label}
                        value={session.location}
                        action={
                          <Button variant="ghost" size="sm" icon="copy">
                            Copy
                          </Button>
                        }
                      />
                    )}
                  </div>
                </Card>

                <Card padded={false}>
                  <CardHead title="Payment" />
                  <div className="p-5">
                    <Row label="Subtotal" value={gbp(booking.amountCents)} />
                    <Row
                      label="Tax (19%)"
                      value={gbp(Math.round(booking.amountCents * 0.19))}
                    />
                    <div className="border-t border-line-soft my-3" />
                    <Row
                      label="Total"
                      value={gbp(Math.round(booking.amountCents * 1.19))}
                      bold
                    />
                  </div>
                </Card>

                {booking.notes && (
                  <Card padded={false}>
                    <CardHead title="Notes" />
                    <div className="p-5 text-body italic">&ldquo;{booking.notes}&rdquo;</div>
                  </Card>
                )}
              </div>

              <div className="flex flex-col gap-6 lg:sticky lg:top-24">
                {client && (
                  <Card padded>
                    <div className="flex items-center gap-3">
                      <Avatar name={client.name} size={48} />
                      <div className="min-w-0">
                        <div className="text-[15px] font-medium text-ink truncate">
                          {client.name}
                        </div>
                        <div className="text-small truncate">
                          {client.company ?? client.email}
                        </div>
                      </div>
                    </div>
                    <DetailLine icon="mail" label="Email" value={client.email} />
                    {client.phone && (
                      <DetailLine icon="phone" label="Phone" value={client.phone} />
                    )}
                    {client.timezone && (
                      <DetailLine
                        icon="globe"
                        label="Timezone"
                        value={client.timezone}
                      />
                    )}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-line-soft mt-3">
                      <Stat
                        label="Bookings"
                        value={String(client.totalBookings)}
                      />
                      <Stat
                        label="Spent"
                        value={gbp(client.totalSpentCents)}
                      />
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </>
        )}
      </PageContainer>
    </>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-[14px] py-1">
      <span className="text-ink-3">{label}</span>
      <span className={bold ? "font-medium text-ink text-[15px]" : "text-ink"}>
        {value}
      </span>
    </div>
  );
}
