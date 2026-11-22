"use client";

import * as React from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CardHead } from "@/components/shared/CardHead";
import { useToast } from "@/components/ui/Toast";
import { completeBooking, markBookingNoShow } from "@/services/bookings.service";
import type { Booking } from "@/types/booking";

/**
 * After a 1:1 session: did it happen? Group sessions record per-attendee attendance in
 * the session drawer instead.
 */
export function BookingOutcomeCard({
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
      onSaved(outcome === "complete" ? await completeBooking(booking.id) : await markBookingNoShow(booking.id));
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
        <Button size="sm" loading={busy === "complete"} disabled={busy !== null} onClick={() => record("complete")}>
          {uiText("ui.completed")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={busy === "noshow"}
          disabled={busy !== null}
          onClick={() => record("noshow")}
        >
          {uiText("ui.no.show")}
        </Button>
      </div>
    </Card>
  );
}
