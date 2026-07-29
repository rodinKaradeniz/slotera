"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSetCrumbs } from "@/components/layout/PageMeta";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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
import { getSettings } from "@/services/settings.service";
import { formatAddressSummary } from "@/components/shared/forms/AddressForm";
import { gbp } from "@/lib/money";
import { fmtDate } from "@/lib/time";
import { LOC_TYPE_META } from "@/lib/status-maps";
import { dataSource } from "@/lib/env";
import type { Booking } from "@/types/booking";
import type { Client } from "@/types/client";
import type { Service } from "@/types/service";
import type { SessionItem } from "@/types/session";
import type { SettingsData } from "@/types/settings";

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { openBookingDrawer } = useDrawers();
  const [booking, setBooking] = React.useState<Booking | null>(null);
  const [client, setClient] = React.useState<Client | null>(null);
  const [session, setSession] = React.useState<SessionItem | null>(null);
  const [service, setService] = React.useState<Service | null>(null);
  const [settings, setSettings] = React.useState<SettingsData | null>(null);
  const [reload, setReload] = React.useState(0);

  React.useEffect(() => {
    let live = true;
    getSettings().then((s) => {
      if (live) setSettings(s);
    });
    return () => {
      live = false;
    };
  }, []);

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

  const taxRate = settings?.payments.taxRate ?? 19;

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
                dataSource === "mock" ? (
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
                ) : undefined
              }
            />

            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
              {/* Left: what session/booking is this? */}
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

                        <div className="mt-4 divide-y divide-line-soft border-t border-line-soft">
                          <DetailLine
                            icon="clipboard"
                            label="Service"
                            value={service?.name ?? "—"}
                          />
                          <DetailLine
                            icon="user"
                            label="Client"
                            value={
                              client ? (
                                <Link
                                  href={`/admin/clients/${booking.clientId}`}
                                  className="text-accent hover:underline"
                                >
                                  {client.name}
                                </Link>
                              ) : (
                                "—"
                              )
                            }
                          />
                          <DetailLine
                            icon="check"
                            label="Booking status"
                            value={
                              <StatusBadge kind="booking" status={booking.status} />
                            }
                          />
                        </div>

                        <div className="mt-4 grid sm:grid-cols-3 gap-3">
                          <Stat label="Capacity" value={`${session.bookedCount} / ${session.capacity}`} />
                          <Stat label="Recurrence" value={session.recurring} />
                          <Stat label="Session" value={session.status} />
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
                    {session ? (
                      <>
                        <DetailLine
                          icon={LOC_TYPE_META[session.locationType].icon}
                          label={LOC_TYPE_META[session.locationType].label}
                          value={
                            session.locationType === "online"
                              ? session.location || "Meeting link shared before the session"
                              : session.location || "—"
                          }
                          action={
                            <Button variant="ghost" size="sm" icon="copy">
                              Copy
                            </Button>
                          }
                        />
                        {session.address && (
                          <DetailLine
                            icon="map-pin"
                            label="Address"
                            value={formatAddressSummary(session.address)}
                          />
                        )}
                      </>
                    ) : (
                      <p className="text-small p-3">Location unavailable.</p>
                    )}
                  </div>
                </Card>

                {booking.notes && (
                  <Card padded={false}>
                    <CardHead title="Booking note" />
                    <div className="p-5 text-body italic">&ldquo;{booking.notes}&rdquo;</div>
                  </Card>
                )}
              </div>

              {/* Right: what is the payment situation? */}
              <div className="flex flex-col gap-6 lg:sticky lg:top-24">
                <Card padded={false}>
                  <CardHead title="Payment" />
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-line-soft">
                      <span className="text-ink-3 text-[14px]">Status</span>
                      <StatusBadge kind="payment" status={booking.paymentStatus} />
                    </div>
                    <Row label="Subtotal" value={gbp(booking.amountCents)} />
                    <Row
                      label={`Tax (${taxRate}%)`}
                      value={gbp(Math.round(booking.amountCents * (taxRate / 100)))}
                    />
                    <div className="border-t border-line-soft my-3" />
                    <Row
                      label="Total"
                      value={gbp(
                        Math.round(booking.amountCents * (1 + taxRate / 100)),
                      )}
                      bold
                    />

                    {settings?.payments.manualPaymentEnabled &&
                      settings.payments.manualPaymentInstructions.trim() && (
                        <div className="mt-5">
                          <div className="eyebrow mb-2">
                            Manual payment instructions
                          </div>
                          <div className="rounded-lg bg-paper-2 border border-line-soft p-3 text-[13px] text-ink-2 whitespace-pre-line">
                            {settings.payments.manualPaymentInstructions}
                          </div>
                        </div>
                      )}
                  </div>
                </Card>
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
