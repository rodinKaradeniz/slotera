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
import type { Currency } from "@/types/common";

/**
 * Settings → Billing & Subscription in the real app. Plans are Free and Pro; Pro is
 * set by Slotera staff and invoiced manually until card billing exists, so upgrading
 * starts a conversation rather than a checkout.
 */
export function ApiBillingPanel() {
  const [billing, setBilling] = React.useState<WorkspaceBilling | null>(null);
  const [contactOpen, setContactOpen] = React.useState(false);
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

  return (
    <>
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
                + {plan.cardFeeBps / 100}% per card payment
              </p>
              {!current && plan.id === "pro" && (
                <Button className="mt-5" onClick={() => setContactOpen(true)}>
                  Upgrade to Pro
                </Button>
              )}
              {!current && plan.id === "free" && (
                <Button variant="ghost" className="mt-5" onClick={() => setContactOpen(true)}>
                  Switch to Free
                </Button>
              )}
            </Card>
          );
        })}
      </div>
      <p className="text-small">
        The per-payment cut applies to card payments only. Manual bank transfers are never
        charged. Plan changes are handled by the Slotera team for now.
      </p>
      <ContactModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        persist
        defaultReason="business"
        presetName={operator?.name}
        presetEmail={operator?.email}
        presetMessage={
          billing.plan === "pro"
            ? "I'd like to move my workspace back to the Free plan."
            : "I'd like to upgrade my workspace to Pro."
        }
      />
    </>
  );
}
