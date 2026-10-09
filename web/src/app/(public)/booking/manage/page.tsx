"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookingTopBar } from "@/components/layout/BookingTopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { DetailLine } from "@/components/shared/DetailLine";
import { StatusScreen } from "@/components/layout/StatusScreen";
import { formatAddressSummary } from "@/components/shared/forms/AddressForm";
import { StepDateTime } from "@/components/booking/StepDateTime";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  cancelManagedBooking,
  getManagedBooking,
  rescheduleManagedBooking,
  setPublicWorkspaceSlug,
  type ManagedBooking,
} from "@/services/public-booking.service";
import { dataSource } from "@/lib/env";
import { localeForLang } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import type { Currency, Tone } from "@/types/common";
import type { Service } from "@/types/service";
import type { Messages } from "@/i18n/messages/en";

const STATUS_TONE: Record<ManagedBooking["status"], Tone> = {
  confirmed: "accent",
  pending: "warning",
  cancelled: "neutral",
  completed: "neutral",
  noshow: "neutral",
};

/**
 * The customer's page for one booking, opened from the link in their booking emails.
 * The token lives in the URL fragment (`#…`), which browsers never send to servers.
 */
export default function ManageBookingPage() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const locale = localeForLang(lang);
  const [token, setToken] = React.useState<string | null>(null);
  const [booking, setBooking] = React.useState<ManagedBooking | null>(null);
  const [invalid, setInvalid] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [rescheduling, setRescheduling] = React.useState(false);
  const [pick, setPick] = React.useState<{
    date: string | null;
    time: string | null;
    startAt: string | null;
  }>({ date: null, time: null, startAt: null });

  React.useEffect(() => {
    if (dataSource === "mock") {
      router.replace("/booking/manage/demo");
      return;
    }
    const fromHash = window.location.hash.slice(1);
    if (!fromHash) {
      setInvalid(true);
      return;
    }
    setToken(fromHash);
    getManagedBooking(fromHash)
      .then((result) => {
        // Rescheduling reads availability for this booking's workspace.
        setPublicWorkspaceSlug(result.workspaceSlug);
        setBooking(result);
      })
      .catch(() => setInvalid(true));
    return () => setPublicWorkspaceSlug(null);
  }, [router]);

  if (invalid) {
    return (
      <StatusScreen
        icon="link"
        eyebrow={t("manage.eyebrow")}
        title={t("manage.invalid.title")}
        body={t("manage.invalid.body")}
      />
    );
  }

  const when = (iso: string) =>
    new Date(iso).toLocaleString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: booking?.timezone,
      timeZoneName: "short",
    });

  const run = async (action: () => Promise<ManagedBooking>, doneKey: keyof Messages) => {
    setBusy(true);
    try {
      setBooking(await action());
      toast.success(t(doneKey));
      setRescheduling(false);
      setConfirmCancel(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <BookingTopBar consultantName={booking?.providerName} />
      <main className="flex-1 max-w-[720px] mx-auto w-full px-6 pt-12 pb-16 flex flex-col gap-4">
        {!booking || !token ? (
          <Card padded>
            <div className="flex flex-col gap-3" aria-label={t("manage.loading")}>
              <Skeleton h={28} w="50%" />
              <Skeleton h={18} />
              <Skeleton h={18} w="70%" />
            </div>
          </Card>
        ) : (
          <>
            <Card padded>
              <p className="eyebrow">{t("manage.eyebrow")}</p>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <h1 className="text-h2 text-ink">{booking.serviceName}</h1>
                <Pill tone={STATUS_TONE[booking.status]}>
                  {t(`manage.status.${booking.status}` as keyof Messages)}
                </Pill>
              </div>
              <p className="text-small mt-1">{booking.reference}</p>
              {booking.status === "pending" && (
                <div className="mt-4 rounded-md border border-line-soft bg-surface-warm px-4 py-3 text-small text-ink-2 flex flex-col gap-1">
                  {booking.pendingReasons.includes("approval") && (
                    <span>{t("manage.pending.approval")}</span>
                  )}
                  {booking.pendingReasons.includes("payment") && (
                    <span>{t("manage.pending.payment")}</span>
                  )}
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-3 mt-6">
                <DetailLine icon="calendar" label={t("manage.when")} value={when(booking.sessionStartAt)} />
                <DetailLine
                  icon="map-pin"
                  label={t("manage.where")}
                  value={
                    booking.sessionAddress
                      ? `${booking.sessionLocation} · ${formatAddressSummary({
                          ...booking.sessionAddress,
                          street2: booking.sessionAddress.street2 ?? undefined,
                          region: booking.sessionAddress.region ?? undefined,
                          notes: booking.sessionAddress.notes ?? undefined,
                        })}`
                      : booking.sessionLocation || "—"
                  }
                />
                <DetailLine icon="user" label={t("manage.provider")} value={booking.providerName} />
                <DetailLine
                  icon="wallet"
                  label={t("manage.amount")}
                  value={formatMoney(booking.amountCents, booking.currency as Currency)}
                />
              </div>
              {booking.manualPaymentInstructions && (
                <div className="mt-5">
                  <p className="text-micro">{t("manage.paymentInstructions")}</p>
                  <p className="text-body whitespace-pre-line mt-1">
                    {booking.manualPaymentInstructions}
                  </p>
                  {booking.paymentDueAt && (
                    <p className="text-small mt-1">
                      {t("manage.paymentDue", { date: when(booking.paymentDueAt) })}
                    </p>
                  )}
                </div>
              )}
              {booking.cancellationRule && (
                <p className="text-small mt-5">
                  <span className="text-ink-2">{t("manage.policy")}:</span>{" "}
                  {booking.cancellationRule}
                </p>
              )}
            </Card>

            {(booking.status === "pending" || booking.status === "confirmed") && (
              <Card padded>
                {booking.canCancel ? (
                  <p className="text-small">
                    {t("manage.changeUntil", { date: when(booking.changeDeadline) })}
                  </p>
                ) : (
                  <p className="text-small">
                    {t("manage.changeClosed", { name: booking.providerName })}
                  </p>
                )}
                {booking.canCancel && !booking.canReschedule && booking.rescheduled && (
                  <p className="text-small mt-1">
                    {t("manage.rescheduleOnce", { name: booking.providerName })}
                  </p>
                )}

                {rescheduling && (
                  <div className="mt-5">
                    <StepDateTime
                      service={{ id: booking.serviceId } as Service}
                      date={pick.date}
                      time={pick.time}
                      startAt={pick.startAt}
                      onChange={setPick}
                    />
                  </div>
                )}

                <div className="flex flex-wrap justify-end gap-2 mt-5">
                  {rescheduling ? (
                    <>
                      <Button variant="ghost" onClick={() => setRescheduling(false)}>
                        {t("manage.reschedule.cancel")}
                      </Button>
                      <Button
                        loading={busy}
                        disabled={!pick.startAt}
                        onClick={() =>
                          pick.startAt &&
                          run(
                            () => rescheduleManagedBooking(token, pick.startAt as string),
                            "manage.reschedule.done",
                          )
                        }
                      >
                        {t("manage.reschedule.confirm")}
                      </Button>
                    </>
                  ) : (
                    <>
                      {booking.canCancel && (
                        <Button variant="danger" icon="x" onClick={() => setConfirmCancel(true)}>
                          {t("manage.cancel")}
                        </Button>
                      )}
                      {booking.canReschedule && (
                        <Button variant="secondary" icon="calendar" onClick={() => setRescheduling(true)}>
                          {t("manage.reschedule")}
                        </Button>
                      )}
                      {booking.providerEmail && (
                        <a href={`mailto:${booking.providerEmail}`}>
                          <Button variant="ghost" icon="mail">
                            {t("manage.contact")}
                          </Button>
                        </a>
                      )}
                    </>
                  )}
                </div>
              </Card>
            )}

            <ConfirmDialog
              open={confirmCancel}
              onClose={() => !busy && setConfirmCancel(false)}
              onConfirm={() => run(() => cancelManagedBooking(token), "manage.cancel.done")}
              title={t("manage.cancel.title")}
              description={t("manage.cancel.body")}
              confirmLabel={t("manage.cancel")}
              cancelLabel={t("manage.cancel.keep")}
              destructive
              busy={busy}
            />
          </>
        )}
      </main>
    </div>
  );
}
