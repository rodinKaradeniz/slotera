"use client";

import * as React from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CardHead } from "@/components/shared/CardHead";
import { BookingPackageLine } from "@/components/admin/bookings/BookingPackageLine";
import { Button } from "@/components/ui/Button";
import { RefundDialog } from "@/components/shared/RefundDialog";
import { getSettings } from "@/services/settings.service";
import { recordBookingRefund, refundableCents } from "@/services/bookings.service";
import { fmtDate } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { dataSource } from "@/lib/env";
import type { Booking } from "@/types/booking";
import type { SettingsData } from "@/types/settings";

/** The booking's payment: status, the amounts, refunds, and the manual payment instructions. */
export function BookingPaymentCard({ booking, onChanged }: { booking: Booking; onChanged: (booking: Booking) => void }) {
  const { t: uiText } = useI18n();
  const [settings, setSettings] = React.useState<SettingsData | null>(null);
  const [refunding, setRefunding] = React.useState(false);
  const refundable = refundableCents(booking);
  const refunded = booking.refundedCents ?? 0;

  React.useEffect(() => {
    let live = true;
    if (dataSource === "api") return;
    getSettings().then((s) => {
      if (live) setSettings(s);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <Card padded={false}>
      <CardHead title={uiText("ui.payment")} />
      <div className="p-5">
        <div className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-line-soft">
          <span className="text-ink-3 text-[14px]">{uiText("ui.status")}</span>
          <StatusBadge kind="payment" status={booking.paymentStatus} />
        </div>
        <BookingPackageLine booking={booking} />
        <Row
          label={uiText("ui.subtotal")}
          value={formatMoney(booking.netAmountCents ?? booking.amountCents, booking.currency)}
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
        <Row label={uiText("ui.total")} value={formatMoney(booking.amountCents, booking.currency)} bold />
        {refunded > 0 && (
          <Row
            label={booking.refundedAtISO ? uiText("refund.refundedOn", { date: fmtDate(new Date(booking.refundedAtISO)) }) : uiText("refund.refunded")}
            value={`− ${formatMoney(refunded, booking.currency)}`}
          />
        )}
        {refundable > 0 && (
          <Button size="sm" variant="secondary" className="mt-4 print:hidden" onClick={() => setRefunding(true)}>
            {uiText("refund.record")}
          </Button>
        )}
        <RefundDialog
          open={refunding}
          refundableCents={refundable}
          currency={booking.currency}
          onClose={() => setRefunding(false)}
          onRefund={async (amount) => onChanged(await recordBookingRefund(booking.id, amount))}
        />

        {(booking.manualPaymentInstructionsSnapshot?.trim() ||
          (dataSource === "mock" &&
            settings?.payments.manualPaymentEnabled &&
            settings.payments.manualPaymentInstructions.trim())) && (
          <div className="mt-5">
            <div className="eyebrow mb-2">{uiText("ui.manual.payment.instructions")}</div>
            <div className="rounded-lg bg-paper-2 border border-line-soft p-3 text-[13px] text-ink-2 whitespace-pre-line">
              {booking.manualPaymentInstructionsSnapshot || settings?.payments.manualPaymentInstructions}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-[14px] py-1">
      <span className="text-ink-3">{label}</span>
      <span className={bold ? "font-medium text-ink text-[15px]" : "text-ink"}>{value}</span>
    </div>
  );
}
