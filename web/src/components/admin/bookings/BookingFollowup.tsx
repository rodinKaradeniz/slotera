"use client";
import {
  RecoverableError,
  toError,
} from "@/components/shared/RecoverableError";
import { BOOKING_EMAIL_STATUS } from "@/lib/status-maps";
import * as React from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useLoad } from "@/lib/use-load";
import { dataSource } from "@/lib/env";
import {
  commandFollowup,
  getBookingFollowup,
  type Followup,
} from "@/services/followups.service";
export function BookingFollowup({ bookingId }: { bookingId: string }) {
  const { t } = useI18n();
  const result = useLoad(
    React.useCallback(
      (signal?: AbortSignal) => getBookingFollowup(bookingId, signal),
      [bookingId],
    ),
  );
  const [review, setReview] = React.useState<{
    action: "send" | "skip";
    value: Followup;
    key: string;
  } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState<Error | null>(null);
  async function submit() {
    if (!review || busy) return;
    setBusy(true);
    setFailed(null);
    try {
      await commandFollowup(bookingId, review.action, review.value, review.key);
      setReview(null);
      result.reload();
    } catch (cause) {
      setFailed(toError(cause));
      result.reload();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <h2 className="text-h3 mb-3">{t("followup.title")}</h2>
      <p>{t("followup.bookingHint")}</p>
      {dataSource === "mock" && <p>{t("booking.emails.local")}</p>}
      {(failed || result.error) && (
        <div role="alert">
          {failed ? (
            <RecoverableError error={failed} messageKey="followup.failed" />
          ) : (
            t("followup.failed")
          )}{" "}
          <Button
            variant="ghost"
            onClick={() => {
              setReview(null);
              setFailed(null);
              result.reload();
            }}
          >
            {t("followup.reviewAgain")}
          </Button>
        </div>
      )}
      {result.data && (
        <>
          <p>
            {t(
              `followup.state.${result.data.state}` as Parameters<typeof t>[0],
            )}
          </p>
          <p>{result.data.recipientEmail}</p>
          {result.data.deliveryStatus && (
            <p>
              {t(
                BOOKING_EMAIL_STATUS[
                  result.data
                    .deliveryStatus as keyof typeof BOOKING_EMAIL_STATUS
                ]?.label ?? "client.failed",
              )}
            </p>
          )}
          <p className="whitespace-pre-wrap">{result.data.message}</p>
          <div className="flex gap-2 mt-3">
            {(["send", "skip"] as const).map((action) => (
              <Button
                key={action}
                disabled={!result.data?.canSend}
                variant={action === "send" ? "primary" : "secondary"}
                onClick={() => {
                  setFailed(null);
                  setReview({
                    action,
                    value: result.data!,
                    key: crypto.randomUUID(),
                  });
                }}
              >
                {t(action === "send" ? "followup.send" : "followup.skip")}
              </Button>
            ))}
          </div>
        </>
      )}
      <ConfirmDialog
        open={!!review}
        busy={busy}
        onClose={() => !busy && setReview(null)}
        onConfirm={submit}
        title={t(review?.action === "skip" ? "followup.skip" : "followup.send")}
        description={`${t("followup.review")} ${review?.value.recipientEmail ?? ""}`}
        confirmLabel={t(
          review?.action === "skip" ? "followup.skip" : "followup.send",
        )}
      />
    </Card>
  );
}
