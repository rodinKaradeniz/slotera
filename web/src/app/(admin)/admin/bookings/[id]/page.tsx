"use client";
import { useI18n } from "@/components/i18n/I18nProvider";
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
import {
  approveBooking,
  cancelBooking,
  declineBooking,
  getBooking,
  completeBooking,
  markBookingNoShow,
  markBookingPaymentReceived,
} from "@/services/bookings.service";
import { getSession } from "@/services/sessions.service";
import { getService } from "@/services/services.service";
import { getClient } from "@/services/clients.service";
import { getSettings } from "@/services/settings.service";
import { formatAddressSummary } from "@/components/shared/forms/AddressForm";
import { formatMoney } from "@/lib/money";
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
import type { SettingsData } from "@/types/settings";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { MoveBookingDialog } from "@/components/admin/bookings/MoveBookingDialog";

type BookingAction = "approve" | "decline" | "payment" | "cancel";

export default function BookingDetailPage() {
  const { t: uiText } = useI18n();
  const timezone = useWorkspaceTimezone();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { openBookingDrawer } = useDrawers();
  const { toast } = useToast();
  const [booking, setBooking] = React.useState<Booking | null>(null);
  const [client, setClient] = React.useState<Client | null>(null);
  const [session, setSession] = React.useState<SessionItem | null>(null);
  // Attendance can be recorded once the session has started; checked when it loads.
  const [sessionStarted, setSessionStarted] = React.useState(false);
  const [service, setService] = React.useState<Service | null>(null);
  const [settings, setSettings] = React.useState<SettingsData | null>(null);
  const [reload, setReload] = React.useState(0);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<BookingAction | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [moving, setMoving] = React.useState(false);

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
    getBooking(params.id)
      .then(async (b) => {
        if (!live) return;
        setLoadError(null);
        setBooking(b);
        if (!b) return;
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
          setLoadError(cause instanceof Error ? cause.message : uiText("ui.couldn.t.load.this.booking"));
        }
      });
    return () => {
      live = false;
    };
  }, [params?.id, reload, uiText]);

  useSetCrumbs([
    { label: uiText("ui.bookings"), href: "/admin/bookings" },
    { label: booking ? booking.id : uiText("ui.detail") },
  ]);

  const runAction = async () => {
    if (!booking || !pendingAction) return;
    setBusy(true);
    try {
      const next =
        pendingAction === "approve"
          ? await approveBooking(booking.id)
          : pendingAction === "decline"
            ? await declineBooking(booking.id)
            : pendingAction === "payment"
              ? await markBookingPaymentReceived(booking.id)
              : await cancelBooking(booking.id);
      setBooking(next);
      setReload((value) => value + 1);
      toast.success(
        pendingAction === "payment"
          ? uiText("ui.payment.recorded")
          : pendingAction === "approve"
            ? uiText("ui.booking.approved")
            : pendingAction === "decline"
              ? uiText("ui.booking.declined")
              : uiText("ui.booking.cancelled"),
      );
      setPendingAction(null);
    } catch (error) {
      toast.error(uiText("ui.the.booking.could.not.be.updated"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
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
                  <span className="font-mono uppercase tracking-widest text-micro">
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

            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
              {/* Left: what session/booking is this? */}
              <div className="flex flex-col gap-6">
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
                      <OutcomeCard booking={booking} onSaved={setBooking} />
                    </div>
                  )}
                {dataSource === "api" &&
                  (booking.status === "pending" || booking.status === "confirmed") && (
                  <Card padded={false} className="print:hidden">
                    <CardHead
                      title={booking.status === "pending" ? uiText("ui.actions.needed") : uiText("ui.booking.actions")}
                    />
                    <div className="p-5 space-y-4">
                      {booking.status === "pending" && (
                        <div className="text-small">
                          {booking.pendingReasons?.includes("approval") && (
                            <p>{uiText("ui.this.booking.is.waiting.for.your.approval")}</p>
                          )}
                          {booking.pendingReasons?.includes("payment") && (
                            <p>{uiText("ui.manual.payment.has.not.been.recorded.yet")}</p>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {booking.approvalStatus === "pending" && (
                          <>
                            <Button size="sm" onClick={() => setPendingAction("approve")}>
                              {uiText("ui.approve.booking")}</Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => setPendingAction("decline")}
                            >
                              {uiText("ui.decline")}</Button>
                          </>
                        )}
                        {booking.paymentMethod === "manual" &&
                          booking.paymentStatus === "pending" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setPendingAction("payment")}
                            >
                              {uiText("ui.mark.payment.received")}</Button>
                          )}
                        <Button size="sm" variant="secondary" onClick={() => setMoving(true)}>
                          {uiText("ui.move.to.another.session")}</Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPendingAction("cancel")}
                        >
                          {uiText("ui.cancel.booking")}</Button>
                      </div>
                    </div>
                  </Card>
                )}

                <Card padded={false}>
                  <CardHead title={uiText("ui.payment")} />
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-line-soft">
                      <span className="text-ink-3 text-[14px]">{uiText("ui.status")}</span>
                      <StatusBadge kind="payment" status={booking.paymentStatus} />
                    </div>
                    <Row
                      label={uiText("ui.subtotal")}
                      value={formatMoney(
                        booking.netAmountCents ?? booking.amountCents,
                        booking.currency,
                      )}
                    />
                    <Row
                      label={
                        booking.taxRateBps
                          ? `${booking.taxLabel ?? uiText("ui.tax")} (${booking.taxRateBps / 100}%)`
                          : booking.taxLabel ?? uiText("ui.tax")
                      }
                      value={formatMoney(booking.taxAmountCents ?? 0, booking.currency)}
                    />
                    <div className="border-t border-line-soft my-3" />
                    <Row
                      label={uiText("ui.total")}
                      value={formatMoney(booking.amountCents, booking.currency)}
                      bold
                    />

                    {(booking.manualPaymentInstructionsSnapshot?.trim() ||
                      (dataSource === "mock" &&
                        settings?.payments.manualPaymentEnabled &&
                        settings.payments.manualPaymentInstructions.trim())) && (
                        <div className="mt-5">
                          <div className="eyebrow mb-2">
                            {uiText("ui.manual.payment.instructions")}</div>
                          <div className="rounded-lg bg-paper-2 border border-line-soft p-3 text-[13px] text-ink-2 whitespace-pre-line">
                            {booking.manualPaymentInstructionsSnapshot ||
                              settings?.payments.manualPaymentInstructions}
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
      <MoveBookingDialog
        open={moving}
        onClose={() => setMoving(false)}
        booking={booking}
        onMoved={(next) => {
          setBooking(next);
          setReload((value) => value + 1);
        }}
      />
      <ConfirmDialog
        open={pendingAction !== null}
        onClose={() => !busy && setPendingAction(null)}
        onConfirm={runAction}
        title={
          pendingAction === "payment"
            ? uiText("ui.record.manual.payment")
            : pendingAction === "approve"
              ? uiText("ui.approve.this.booking")
              : pendingAction === "decline"
                ? uiText("ui.decline.this.booking")
                : uiText("ui.cancel.this.booking")
        }
        description={
          pendingAction === "payment"
            ? uiText("ui.this.records.that.the.provider.received.payment.the.booking.confirms.automatically.once.ev")
            : pendingAction === "approve"
              ? uiText("ui.the.booking.confirms.now.if.payment.is.already.satisfied.otherwise.it.remains.payment.pend")
              : uiText("ui.the.slot.will.become.available.again.when.this.is.a.public.capacity.one.booking.payment.st")
        }
        confirmLabel={
          pendingAction === "payment"
            ? uiText("ui.record.payment")
            : pendingAction === "approve"
              ? uiText("ui.approve")
              : pendingAction === "decline"
                ? uiText("ui.decline")
                : uiText("ui.cancel.booking")
        }
        destructive={pendingAction === "decline" || pendingAction === "cancel"}
        busy={busy}
      />
    </>
  );
}

/**
 * After a 1:1 session: did it happen? Group sessions record per-attendee attendance in
 * the session drawer instead.
 */
function OutcomeCard({
  booking,
  onSaved,
}: {
  booking: Booking;
  onSaved: (booking: Booking) => void;
}) {
  const { t: uiText } = useI18n();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<"complete" | "noshow" | null>(null);
  const record = async (outcome: "complete" | "noshow") => {
    setBusy(outcome);
    try {
      onSaved(
        outcome === "complete"
          ? await completeBooking(booking.id)
          : await markBookingNoShow(booking.id),
      );
      toast.success(outcome === "complete" ? uiText("ui.session.marked.as.completed") : uiText("ui.marked.as.no.show"));
    } catch (error) {
      toast.error(uiText("ui.couldn.t.record.the.outcome"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card padded={false}>
      <CardHead title={uiText("ui.session.outcome")} />
      <div className="p-5 flex flex-wrap gap-2">
        <Button
          size="sm"
          loading={busy === "complete"}
          disabled={busy !== null}
          onClick={() => record("complete")}
        >
          {uiText("ui.completed")}</Button>
        <Button
          size="sm"
          variant="secondary"
          loading={busy === "noshow"}
          disabled={busy !== null}
          onClick={() => record("noshow")}
        >
          {uiText("ui.no.show")}</Button>
      </div>
    </Card>
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
