"use client";

import * as React from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CardHead } from "@/components/shared/CardHead";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { MoveBookingDialog } from "@/components/admin/bookings/MoveBookingDialog";
import {
  approveBooking,
  cancelBooking,
  declineBooking,
  markBookingPaymentReceived,
} from "@/services/bookings.service";
import type { Booking } from "@/types/booking";

type BookingAction = "approve" | "decline" | "payment" | "cancel";

/** Approve, decline, record payment, move or cancel a pending or confirmed booking. */
export function BookingActionsCard({
  booking,
  onChanged,
}: {
  booking: Booking;
  onChanged: (booking: Booking) => void;
}) {
  const { t: uiText } = useI18n();
  const { toast } = useToast();
  const [pendingAction, setPendingAction] = React.useState<BookingAction | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [moving, setMoving] = React.useState(false);

  const runAction = async () => {
    if (!pendingAction) return;
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
      onChanged(next);
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
      <Card padded={false} className="print:hidden">
        <CardHead title={booking.status === "pending" ? uiText("ui.actions.needed") : uiText("ui.booking.actions")} />
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
                  {uiText("ui.approve.booking")}
                </Button>
                <Button size="sm" variant="danger" onClick={() => setPendingAction("decline")}>
                  {uiText("ui.decline")}
                </Button>
              </>
            )}
            {booking.paymentMethod === "manual" && booking.paymentStatus === "pending" && (
              <Button size="sm" variant="secondary" onClick={() => setPendingAction("payment")}>
                {uiText("ui.mark.payment.received")}
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => setMoving(true)}>
              {uiText("ui.move.to.another.session")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPendingAction("cancel")}>
              {uiText("ui.cancel.booking")}
            </Button>
          </div>
        </div>
      </Card>
      <MoveBookingDialog open={moving} onClose={() => setMoving(false)} booking={booking} onMoved={onChanged} />
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
