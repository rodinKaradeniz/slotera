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
import type { PaymentMethod, SettingsData } from "@/types/settings";
import type { BookingDraft } from "./types";
import { ReceiptCard } from "./ReceiptCard";

type Payment = BookingDraft["payment"];

type Props = {
  draft: BookingDraft;
  payment: Payment;
  onChange: (next: Payment) => void;
};

const METHOD_META: Record<PaymentMethod, { label: string; icon: IconName }> = {
  card: { label: "Card", icon: "card" },
  manual: { label: "Manual payment", icon: "wallet" },
};

export function StepPayment({ draft, payment, onChange }: Props) {
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
        <div className="eyebrow mb-4">Payment method</div>
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
          {methods.map((m) => {
            const meta = METHOD_META[m];
            return (
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
                <Icon name={meta.icon} size={14} />
                {meta.label}
              </button>
            );
          })}
        </div>

        {payment.method === "card" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cardholder name" required className="sm:col-span-2">
              <Input
                value={payment.cardName}
                onChange={(e) => update({ cardName: e.target.value })}
              />
            </Field>
            <Field
              label="Card number"
              hint="Use 4242 4242 4242 4242 for a mock success, or 4000 0000 0000 0002 for a mock failure."
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
            <Field label="Expiration" required>
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
            <Field label="CVC" required>
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
            <div className="eyebrow">Payment instructions</div>
            <div className="rounded-md border border-line bg-paper-2 p-5">
              {settings?.payments.manualPaymentInstructions ? (
                <p className="text-body whitespace-pre-line text-ink">
                  {settings.payments.manualPaymentInstructions}
                </p>
              ) : (
                <p className="text-small">
                  Payment instructions will be shared after you confirm.
                </p>
              )}
            </div>
            <div className="flex items-start gap-2 text-micro text-ink-3">
              <Icon name="info" size={12} className="mt-0.5" />
              Your booking will be marked pending until the operator confirms
              receipt of payment.
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
