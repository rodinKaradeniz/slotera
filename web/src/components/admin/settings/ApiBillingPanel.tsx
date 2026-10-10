"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { ContactModal } from "@/components/public/ContactModal";
import { getWorkspaceBilling, type WorkspaceBilling } from "@/services/billing.service";
import { currentSession } from "@/services/auth.service";
import { formatMoney } from "@/lib/money";
import { PLAN_LABEL, billingState } from "@/lib/plans";
import { fmtDate } from "@/lib/time";
import type { Currency } from "@/types/common";

/**
 * Settings → Billing & Subscription in the real app. Two paid plans, monthly or yearly,
 * after a 30-day trial. Slotera staff set the plan and invoice by hand until card
 * billing exists, so changing plan starts a conversation rather than a checkout.
 */
export function ApiBillingPanel() {
  const [billing, setBilling] = React.useState<WorkspaceBilling | null>(null);
  const [contactMessage, setContactMessage] = React.useState<string | null>(null);
  const operator = currentSession()?.operator;

  React.useEffect(() => {
    getWorkspaceBilling().then(setBilling);
  }, []);

  if (!billing) {
    return (
      <Card padded>
        <Skeleton h={24} w="40%" />
      </Card>
    );
  }

  const state = billingState(billing.trialEndsAt, billing.paidThrough ?? null);
  const interval = billing.billingInterval === "yearly" ? "yearly" : "monthly";

  return (
    <>
      <Card padded>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] text-ink">
            {PLAN_LABEL[billing.plan]} · billed {interval}
          </span>
          {state.kind === "trial" && (
            <Pill tone="neutral">
              Free trial · ends {fmtDate(new Date(state.endsISO))} ({state.daysLeft}{" "}
              {state.daysLeft === 1 ? "day" : "days"} left)
            </Pill>
          )}
          {state.kind === "paid" && (
            <Pill tone="success">
              Paid through {fmtDate(new Date(`${state.through}T12:00:00`))}
            </Pill>
          )}
          {state.kind === "lapsed" && <Pill tone="warning">Payment due</Pill>}
        </div>
        {state.kind !== "paid" && (
          <p className="text-small mt-2">
            {state.kind === "trial"
              ? "Nothing to pay during the trial. Tell us which plan and billing period you want and we'll send an invoice."
              : "Your trial has ended. Contact us to continue: we'll send an invoice for your plan."}
          </p>
        )}
      </Card>
      <div className="grid sm:grid-cols-2 gap-4">
        {billing.plans.map((plan) => {
          const current = plan.id === billing.plan;
          return (
            <Card key={plan.id} padded className={current ? "border-accent" : undefined}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-h3">{plan.name}</h3>
                {current && <Pill tone="accent">Current plan</Pill>}
              </div>
              <p className="mt-3">
                <span className="font-serif text-ink" style={{ fontSize: 32, fontWeight: 380 }}>
                  {formatMoney(plan.monthlyPriceCents, plan.currency as Currency)}
                </span>
                <span className="text-small"> /mo</span>
              </p>
              <p className="text-small text-ink-2 mt-1">
                or {formatMoney(plan.yearlyPriceCents, plan.currency as Currency)} /yr (2
                months free) · + {plan.cardFeeBps / 100}% per card payment
              </p>
              {plan.id === "professional" && (
                <p className="text-small mt-2">
                  No Slotera branding on your client pages, priority support, and WhatsApp
                  messaging when it launches.
                </p>
              )}
              {!current && (
                <Button
                  variant={plan.id === "professional" ? "primary" : "ghost"}
                  className="mt-5"
                  onClick={() =>
                    setContactMessage(`I'd like to move my workspace to ${plan.name}.`)
                  }
                >
                  Switch to {plan.name}
                </Button>
              )}
            </Card>
          );
        })}
      </div>
      <p className="text-small">
        The per-payment cut applies to card payments only, on top of Stripe&apos;s own
        processing fee. Manual bank transfers are never charged. Plan changes are handled by
        the Slotera team for now.
      </p>
      <ContactModal
        open={contactMessage !== null}
        onClose={() => setContactMessage(null)}
        persist
        defaultReason="business"
        presetName={operator?.name}
        presetEmail={operator?.email}
        presetMessage={contactMessage ?? undefined}
      />
    </>
  );
}
