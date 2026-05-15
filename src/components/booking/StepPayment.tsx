"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { eur } from "@/lib/money";
import { COUNTRIES } from "./types";
import type { BookingDraft } from "./types";

type Payment = BookingDraft["payment"];

type Props = {
  draft: BookingDraft;
  payment: Payment;
  onChange: (next: Payment) => void;
};

export function StepPayment({ draft, payment, onChange }: Props) {
  const country = COUNTRIES.find((c) => c.code === draft.billing.country) ?? COUNTRIES[0];
  const subtotal = draft.service?.priceCents ?? 0;
  const tax = Math.round(subtotal * country.vat);
  const total = subtotal + tax;

  const update = (patch: Partial<Payment>) => onChange({ ...payment, ...patch });

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] items-start">
      <Card padded>
        <div className="eyebrow mb-4">Payment method</div>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {(["card", "paypal", "sepa"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => update({ method: m })}
              className={cn(
                "h-12 rounded-md border text-[13px] font-medium capitalize flex items-center justify-center gap-2",
                payment.method === m
                  ? "border-accent bg-accent-soft text-accent-ink"
                  : "border-line bg-surface hover:border-ink-3",
              )}
            >
              <Icon
                name={m === "card" ? "card" : m === "paypal" ? "paypal" : "wallet"}
                size={14}
              />
              {m === "card" ? "Card" : m === "paypal" ? "PayPal" : "SEPA"}
            </button>
          ))}
        </div>

        {payment.method === "card" ? (
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
                onChange={(e) => update({ cardNumber: e.target.value })}
                placeholder="4242 4242 4242 4242"
                inputMode="numeric"
              />
            </Field>
            <Field label="Expiration" required>
              <Input
                value={payment.cardExp}
                onChange={(e) => update({ cardExp: e.target.value })}
                placeholder="MM/YY"
              />
            </Field>
            <Field label="CVC" required>
              <Input
                value={payment.cardCvc}
                onChange={(e) => update({ cardCvc: e.target.value })}
                placeholder="123"
                inputMode="numeric"
              />
            </Field>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-line p-6 text-small text-center">
            <Icon name="info" size={16} className="mx-auto mb-2" />
            {payment.method === "paypal"
              ? "PayPal checkout is mocked in this demo. You'll be redirected on the next step."
              : "SEPA bank transfer instructions will be emailed after you confirm."}
          </div>
        )}
      </Card>

      <Card padded className="sticky top-24">
        <div className="eyebrow mb-3">Total due now</div>
        <div
          className="font-serif text-ink"
          style={{ fontSize: 36, fontWeight: 380, lineHeight: 1.05 }}
        >
          {total === 0 ? "Free" : eur(total)}
        </div>
        <div className="mt-4 text-small">
          <div>{draft.service?.name}</div>
          <div>
            {draft.date &&
              new Date(draft.date).toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}{" "}
            · {draft.time}
          </div>
        </div>
        <div className="flex items-start gap-2 mt-4 text-micro">
          <Icon name="shield" size={12} /> Encrypted · PCI-DSS via Stripe (mocked)
        </div>
      </Card>
    </div>
  );
}
