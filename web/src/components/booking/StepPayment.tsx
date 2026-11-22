"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { getSettings } from "@/services/settings.service";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { SettingsData } from "@/types/settings";
import type { BookingDraft } from "./types";
import { ReceiptCard } from "./ReceiptCard";

/**
 * The server takes two payment methods: free for £0 services, and manual (bank
 * transfer on the operator's instructions) for paid ones when the operator allows it.
 */
export function StepPayment({ draft }: { draft: BookingDraft }) {
  const { t } = useI18n();
  const [settings, setSettings] = React.useState<SettingsData | null>(null);

  React.useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const instructions = settings?.payments.manualPaymentInstructions ?? null;

  if (draft.service?.priceCents === 0 || draft.packagePurchaseId) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-stretch h-full">
        <Card padded className="flex items-center justify-center h-full">
          <div className="text-center max-w-sm">
            <span className="w-11 h-11 rounded-full bg-accent-soft text-accent mx-auto mb-4 flex items-center justify-center">
              <Icon name="check" size={20} />
            </span>
            <h2 className="text-h3 text-ink">
              {draft.packagePurchaseId ? t("client.packages.covered") : t("ui.no.payment.required")}
            </h2>
            <p className="text-small mt-2">
              {draft.packagePurchaseId
                ? t("booking.packageUse.confirm")
                : t("ui.confirm.the.booking.to.reserve.this.free.session")}
            </p>
          </div>
        </Card>
        <ReceiptCard draft={draft} variant="pay" manualInstructions={null} />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-stretch h-full">
      <Card padded className="flex flex-col h-full">
        <h2 className="text-[13px] text-ink-2 mb-3">{t("booking.payment.instructions")}</h2>
        {settings && !settings.payments.manualPaymentEnabled ? (
          <p role="alert" className="text-body text-ink">{t("booking.payment.unavailable")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-md border border-line bg-paper-2 p-5">
              {instructions ? (
                <p className="text-body whitespace-pre-line text-ink">{instructions}</p>
              ) : (
                <p className="text-small">{t("booking.payment.instructionsFallback")}</p>
              )}
            </div>
            <div className="flex items-start gap-2 text-micro text-ink-3">
              <Icon name="info" size={12} className="mt-0.5" />
              {t("booking.payment.pendingNote")}
            </div>
          </div>
        )}
      </Card>
      <ReceiptCard draft={draft} variant="pay" manualInstructions={instructions} />
    </div>
  );
}
