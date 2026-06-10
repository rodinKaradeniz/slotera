"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import {
  formatCardCvc,
  formatCardExpiry,
  formatCardNumber,
} from "@/lib/card";
import { getSettings } from "@/services/settings.service";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { PaymentMethod, SettingsData } from "@/types/settings";
import type { BookingDraft } from "./types";
import { ReceiptCard } from "./ReceiptCard";

type Payment = BookingDraft["payment"];

type Props = {
  draft: BookingDraft;
  payment: Payment;
  onChange: (next: Payment) => void;
};

const METHOD_ICON: Record<PaymentMethod, IconName> = {
  card: "card",
  manual: "wallet",
};

export function StepPayment({ draft, payment, onChange }: Props) {
  const { t } = useI18n();
  const methodLabel: Record<PaymentMethod, string> = {
    card: t("booking.payment.card"),
    manual: t("booking.payment.manual"),
  };
  const [settings, setSettings] = React.useState<SettingsData | null>(null);

  React.useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const update = (patch: Partial<Payment>) => onChange({ ...payment, ...patch });

  const methods = React.useMemo<PaymentMethod[]>(() => {
    if (!settings) return ["card"];
    const enabled = settings.payments.defaultPaymentMethods.filter((m) =>
      m === "manual" ? settings.payments.manualPaymentEnabled : true,
    );
    return enabled.length > 0 ? enabled : ["card"];
  }, [settings]);

  React.useEffect(() => {
    if (!settings) return;
    if (!methods.includes(payment.method)) {
      update({ method: methods[0] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-stretch h-full">
      <Card padded className="flex flex-col h-full">
        <div className="eyebrow mb-4">{t("booking.payment.method")}</div>
        <div
          className={cn(
            "grid gap-2 mb-6",
            methods.length === 1
              ? "grid-cols-1"
              : methods.length === 2
                ? "grid-cols-2"
                : "grid-cols-3",
          )}
        >
          {methods.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => update({ method: m })}
              className={cn(
                "h-12 rounded-md border text-[13px] font-medium flex items-center justify-center gap-2",
                payment.method === m
                  ? "border-accent bg-accent-soft text-accent-ink"
                  : "border-line bg-surface hover:border-ink-3",
              )}
            >
              <Icon name={METHOD_ICON[m]} size={14} />
              {methodLabel[m]}
            </button>
          ))}
        </div>

        {payment.method === "card" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("booking.payment.cardholderName")} required className="sm:col-span-2">
              <Input
                value={payment.cardName}
                onChange={(e) => update({ cardName: e.target.value })}
              />
            </Field>
            <Field
              label={t("booking.payment.cardNumber")}
              hint={t("booking.payment.cardNumberHint")}
              required
              className="sm:col-span-2"
            >
              <Input
                value={payment.cardNumber}
                onChange={(e) =>
                  update({ cardNumber: formatCardNumber(e.target.value) })
                }
                placeholder="4242 4242 4242 4242"
                inputMode="numeric"
                autoComplete="cc-number"
                maxLength={19}
              />
            </Field>
            <Field label={t("booking.payment.expiration")} required>
              <Input
                value={payment.cardExp}
                onChange={(e) =>
                  update({ cardExp: formatCardExpiry(e.target.value) })
                }
                placeholder="MM / YY"
                inputMode="numeric"
                autoComplete="cc-exp"
                maxLength={7}
              />
            </Field>
            <Field label={t("booking.payment.cvc")} required>
              <Input
                value={payment.cardCvc}
                onChange={(e) =>
                  update({ cardCvc: formatCardCvc(e.target.value) })
                }
                placeholder="123"
                inputMode="numeric"
                autoComplete="cc-csc"
                maxLength={4}
              />
            </Field>
          </div>
        )}

        {payment.method === "manual" && (
          <div className="flex flex-col gap-3">
            <div className="eyebrow">{t("booking.payment.instructions")}</div>
            <div className="rounded-md border border-line bg-paper-2 p-5">
              {settings?.payments.manualPaymentInstructions ? (
                <p className="text-body whitespace-pre-line text-ink">
                  {settings.payments.manualPaymentInstructions}
                </p>
              ) : (
                <p className="text-small">
                  {t("booking.payment.instructionsFallback")}
                </p>
              )}
            </div>
            <div className="flex items-start gap-2 text-micro text-ink-3">
              <Icon name="info" size={12} className="mt-0.5" />
              {t("booking.payment.pendingNote")}
            </div>
          </div>
        )}
      </Card>

      <ReceiptCard
        draft={draft}
        variant="pay"
        manualInstructions={
          settings?.payments.manualPaymentInstructions ?? null
        }
      />
    </div>
  );
}
