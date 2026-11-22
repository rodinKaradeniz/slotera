"use client";
import { useI18n } from "@/components/i18n/I18nProvider";
import { BookingFollowup } from "@/components/admin/bookings/BookingFollowup";
import { BookingEmails } from "@/components/admin/bookings/BookingEmails";
import { BookingForms } from "@/components/booking/BookingForms";
import { SESSION_RECURRENCE_TEXT, SESSION_STATUS_TEXT } from "@/lib/status-maps";

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
import { formatAddressSummary } from "@/components/shared/forms/AddressForm";
import { LoadError } from "@/components/shared/LoadError";
import { clockIn } from "@/lib/calendar";
import { useWorkspaceTimezone } from "@/lib/use-workspace-timezone";
import { fmtDate } from "@/lib/time";
import { LOC_TYPE_META } from "@/lib/status-maps";
import { dataSource } from "@/lib/env";
import type { Booking } from "@/types/booking";
import type { Client } from "@/types/client";
import type { Service } from "@/types/service";
import type { SessionItem } from "@/types/session";
import { BookingActionsCard } from "@/components/admin/bookings/BookingActionsCard";
import { BookingOutcomeCard } from "@/components/admin/bookings/BookingOutcomeCard";
import { BookingPaymentCard } from "@/components/admin/bookings/BookingPaymentCard";

export default function BookingDetailPage() {
  const { t: uiText } = useI18n();
  const timezone = useWorkspaceTimezone();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { openBookingDrawer } = useDrawers();
  const [booking, setBooking] = React.useState<Booking | null>(null);
  const [client, setClient] = React.useState<Pick<Client, "id" | "name" | "email"> | null>(null);
  const [session, setSession] = React.useState<SessionItem | null>(null);
  // Attendance can be recorded once the session has started; checked when it loads.
  const [sessionStarted, setSessionStarted] = React.useState(false);
  const [service, setService] = React.useState<Pick<Service, "id" | "name"> | null>(null);
  const [reload, setReload] = React.useState(0);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const changed = (next: Booking) => {
    setBooking(next);
    setReload((value) => value + 1);
  };

  React.useEffect(() => {
    if (!params?.id) return;
    let live = true;
    getBooking(params.id)
      .then(async (b) => {
        if (!live) return;
        setLoadError(null);
        setBooking(b);
        if (!b) return;
        if (b.context) {
          setClient({id: b.clientId, name: b.context.clientName, email: b.context.clientEmail});
          setSession(b.context.session);
          setSessionStarted(new Date(b.context.session.startISO).getTime() <= Date.now());
          setService({id: b.context.session.serviceId, name: b.context.serviceName});
          return;
        }
        const [cl, ss] = await Promise.all([
          getClient(b.clientId),
          getSession(b.sessionId),
        ]);
        if (!live) return;
        setClient(cl);
        setSession(ss);
        setSessionStarted(!!ss && new Date(ss.startISO).getTime() <= Date.now());
        if (ss) {
          const sv = await getService(ss.serviceId);
          if (live) setService(sv);
        }
      })
      .catch((cause: unknown) => {
        if (live) {
          setLoadError(cause instanceof Error ? cause.message : String(cause));
        }
      });
    return () => {
      live = false;
    };
  }, [params?.id, reload]);

  useSetCrumbs([
    { label: uiText("ui.bookings"), href: "/admin/bookings" },
    { label: booking ? booking.id : uiText("ui.detail") },
  ]);

  return (
      <PageContainer>
        {loadError ? (
          <LoadError message={loadError} onRetry={() => setReload((k) => k + 1)} />
        ) : !booking ? (
          <LoadingRows count={3} />
        ) : (
          <>
            <button
              type="button"
              onClick={() => router.push("/admin/bookings")}
              className="text-small text-ink-3 hover:text-ink mb-4 inline-flex items-center gap-1 self-start print:hidden"
            >
              {uiText("ui.all.bookings")}</button>
            <PageHeader
              eyebrow={uiText("ui.booking")}
              title={service?.name ?? uiText("ui.booking")}
              description={
                session
                  ? `${fmtDate(new Date(session.startISO))} · ${clockIn(session.startISO, timezone)} – ${clockIn(session.endISO, timezone)}`
                  : undefined
              }
              meta={
                <span className="inline-flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-micro">
                    {booking.reference ?? booking.id}
                  </span>
                  <span aria-hidden>·</span>
                  <StatusBadge kind="booking" status={booking.status} />
                  <StatusBadge kind="payment" status={booking.paymentStatus} />
                </span>
              }
            actions={
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                {dataSource === "mock" && (
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
                    {uiText("ui.edit.booking")}</Button>
                )}
                <Button
                  variant="secondary"
                  size="md"
                  icon="download"
                  onClick={() => window.print()}
                >
                  {uiText("ui.print.summary")}</Button>
              </div>
            }
            />

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6 items-start">
              {/* Left: what session/booking is this? */}
              <div className="min-w-0 flex flex-col gap-6">
                <Card padded={false}>
                  <CardHead title={uiText("ui.session")} />
                  <div className="p-5">
                    {session ? (
                      <>
                        <div className="text-h3 text-ink" style={{ fontSize: 26 }}>
                          {fmtDate(new Date(session.startISO))}
                        </div>
                        <div className="text-[15px] text-ink-2 mt-1">
                          {clockIn(session.startISO, timezone)} – {clockIn(session.endISO, timezone)}
                        </div>

                        <div className="mt-4 divide-y divide-line-soft border-t border-line-soft">
                          <DetailLine
                            icon="clipboard"
                            label={uiText("ui.service")}
                            value={service?.name ?? "—"}
                          />
                          <DetailLine
                            icon="user"
                            label={uiText("ui.client")}
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
                            label={uiText("ui.booking.status")}
                            value={
                              <StatusBadge kind="booking" status={booking.status} />
                            }
                          />
                        </div>

                        <div className="mt-4 grid sm:grid-cols-3 gap-3">
                          <Stat label={uiText("ui.capacity")} value={`${session.bookedCount} / ${session.capacity}`} />
                          <Stat label={uiText("ui.recurrence")} value={uiText(SESSION_RECURRENCE_TEXT[session.recurring])} />
                          <Stat label={uiText("ui.session")} value={uiText(SESSION_STATUS_TEXT[session.status])} />
                        </div>
                      </>
                    ) : (
                      <p className="text-small">{uiText("ui.session.details.unavailable")}</p>
                    )}
                  </div>
                </Card>

                <Card padded={false}>
                  <CardHead title={uiText("ui.location")} />
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
                              {uiText("ui.copy")}</Button>
                          }
                        />
                        {session.address && (
                          <DetailLine
                            icon="map-pin"
                            label={uiText("ui.address")}
                            value={formatAddressSummary(session.address)}
                          />
                        )}
                      </>
                    ) : (
                      <p className="text-small p-3">{uiText("ui.location.unavailable")}</p>
                    )}
                  </div>
                </Card>

                {dataSource === "api" && <BookingForms bookingId={booking.id} />}
                <BookingFollowup bookingId={booking.id} />
                <BookingEmails booking={booking} fallbackEmail={client?.email} onUpdated={setBooking} />
                {booking.notes && (
                  <Card padded={false}>
                    <CardHead title={uiText("ui.booking.note")} />
                    <div className="p-5 text-body italic">&ldquo;{booking.notes}&rdquo;</div>
                  </Card>
                )}
              </div>

              {/* Right: what is the payment situation? */}
              <div className="flex flex-col gap-6 lg:sticky lg:top-24">
                {dataSource === "api" &&
                  session?.capacity === 1 &&
                  booking.status === "confirmed" &&
                  sessionStarted && (
                    <div className="print:hidden">
                      <BookingOutcomeCard booking={booking} onSaved={setBooking} />
                    </div>
                  )}
                {dataSource === "api" && (booking.status === "pending" || booking.status === "confirmed") && (
                  <BookingActionsCard booking={booking} onChanged={changed} />
                )}
                <BookingPaymentCard booking={booking} onChanged={changed} />
              </div>
            </div>
          </>
        )}
      </PageContainer>
  );
}
