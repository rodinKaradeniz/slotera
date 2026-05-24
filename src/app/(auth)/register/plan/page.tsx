"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { ContactModal } from "@/components/public/ContactModal";
import { listPlans } from "@/services/billing.service";
import { gbp } from "@/lib/money";
import { cn } from "@/lib/cn";
import {
  readRegisterDraft,
  writeRegisterDraft,
  type RegisterDraft,
} from "@/lib/register-draft";
import type {
  BillingCycle,
  PlanId,
  SubscriptionPlan,
} from "@/types/billing";

export default function RegisterPlanPage() {
  const router = useRouter();
  const [draft, setDraft] = React.useState<RegisterDraft | null>(null);
  const [plans, setPlans] = React.useState<SubscriptionPlan[]>([]);
  const [cycle, setCycle] = React.useState<BillingCycle>("monthly");
  const [picked, setPicked] = React.useState<PlanId | null>(null);
  const [contactOpen, setContactOpen] = React.useState(false);

  React.useEffect(() => {
    const stored = readRegisterDraft();
    if (!stored) {
      // No draft means the user landed here directly — kick them back to /register
      router.replace("/register");
      return;
    }
    setDraft(stored);
    setPicked(stored.planId ?? "team");
    if (stored.billingCycle) setCycle(stored.billingCycle);
    listPlans().then(setPlans);
  }, [router]);

  const continueWith = (planId: PlanId) => {
    if (!draft) return;
    writeRegisterDraft({ ...draft, planId, billingCycle: cycle });
    if (planId === "custom") {
      setContactOpen(true);
      return;
    }
    router.push("/register/payment");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked) return;
    continueWith(picked);
  };

  return (
    <AuthCard
      eyebrow="Step 2 of 3"
      title="Pick a plan."
      subtitle="Monthly billing, 14-day free trial. Switch plans or cancel anytime."
      footer={
        <span>
          <Link href="/register" className="text-ink-3 hover:text-ink">
            ← Back to account details
          </Link>
        </span>
      }
    >
      <form className="flex flex-col gap-6" onSubmit={submit}>
        <div className="flex items-center justify-end">
          <div className="inline-flex rounded-md border border-line p-1 text-[13px]">
            <button
              type="button"
              onClick={() => setCycle("monthly")}
              className={cn(
                "px-3 py-1 rounded",
                cycle === "monthly" ? "bg-ink text-paper" : "text-ink-2",
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setCycle("yearly")}
              className={cn(
                "px-3 py-1 rounded",
                cycle === "yearly" ? "bg-ink text-paper" : "text-ink-2",
              )}
            >
              Yearly · −20%
            </button>
          </div>
        </div>

        {plans.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton h={220} />
            <Skeleton h={220} />
            <Skeleton h={220} />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {plans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                cycle={cycle}
                selected={picked === p.id}
                onSelect={() => setPicked(p.id)}
              />
            ))}
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          iconRight="arrow-right"
          disabled={!picked}
        >
          {picked === "custom"
            ? "Contact sales"
            : picked
              ? "Continue to payment"
              : "Continue"}
        </Button>
      </form>

      <ContactModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        persist
        eyebrow="Custom plan"
        title="Talk to Slotera"
        description="Tell us a bit about your team or use case and someone from Slotera will get back to you within one business day. No account is created until we agree on terms."
        presetName={
          draft
            ? `${draft.firstNames ?? ""} ${draft.lastName ?? ""}`.trim()
            : undefined
        }
        presetEmail={draft?.email}
        defaultReason="business"
        presetMessage="I'd like to talk about a Custom plan — please get in touch."
      />
    </AuthCard>
  );
}

function PlanCard({
  plan,
  cycle,
  selected,
  onSelect,
}: {
  plan: SubscriptionPlan;
  cycle: BillingCycle;
  selected: boolean;
  onSelect: () => void;
}) {
  const price = cycle === "yearly" ? plan.priceYearly : plan.priceMonthly;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "text-left rounded-lg border p-4 transition-colors flex flex-col gap-3",
        selected ? "border-accent bg-accent-soft" : "border-line hover:border-ink-3",
      )}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-h3 text-ink" style={{ fontSize: 16 }}>
          {plan.name}
        </span>
        {plan.highlight && <Pill tone="accent">Popular</Pill>}
        {selected && !plan.highlight && (
          <Icon name="check" size={14} className="text-accent" />
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className="font-serif text-ink"
          style={{ fontSize: 22, fontWeight: 380 }}
        >
          {plan.id === "custom" ? "Custom" : gbp(price)}
        </span>
        {plan.id !== "custom" && (
          <span className="text-small">
            /{cycle === "yearly" ? "yr" : "mo"}
          </span>
        )}
      </div>
      <p className="text-small">{plan.description}</p>
      <ul className="flex flex-col gap-1.5 mt-1">
        {plan.features.slice(0, 3).map((f) => (
          <li
            key={f}
            className="flex items-start gap-1.5 text-[13px] text-ink-2"
          >
            <Icon name="check" size={12} className="text-accent mt-1" />
            {f}
          </li>
        ))}
      </ul>
    </button>
  );
}
