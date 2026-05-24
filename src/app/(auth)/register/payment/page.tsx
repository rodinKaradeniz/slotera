"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";
import { register } from "@/services/auth.service";
import {
  changePlan,
  listPlans,
  updateMockPaymentMethod,
} from "@/services/billing.service";
import { gbp } from "@/lib/money";
import {
  clearRegisterDraft,
  readRegisterDraft,
  resolveTitle,
  type RegisterDraft,
} from "@/lib/register-draft";
import type { SubscriptionPlan } from "@/types/billing";

type CardForm = {
  cardholder: string;
  number: string;
  exp: string;
  cvc: string;
};

const EMPTY_CARD: CardForm = {
  cardholder: "",
  number: "",
  exp: "",
  cvc: "",
};

export default function RegisterPaymentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [draft, setDraft] = React.useState<RegisterDraft | null>(null);
  const [plan, setPlan] = React.useState<SubscriptionPlan | null>(null);
  const [card, setCard] = React.useState<CardForm>(EMPTY_CARD);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const stored = readRegisterDraft();
    if (!stored) {
      router.replace("/register");
      return;
    }
    if (!stored.planId || stored.planId === "custom") {
      // No payment is collected for Custom — they go through ContactModal.
      router.replace("/register/plan");
      return;
    }
    setDraft(stored);
    listPlans().then((plans) => {
      setPlan(plans.find((p) => p.id === stored.planId) ?? null);
    });
    setCard({
      cardholder:
        `${stored.firstNames ?? ""} ${stored.lastName ?? ""}`.trim() || "",
      number: "",
      exp: "",
      cvc: "",
    });
  }, [router]);

  const valid =
    card.cardholder.trim().length > 1 &&
    card.number.replace(/\s/g, "").length >= 12 &&
    /^\d{2}\/\d{2}$/.test(card.exp.trim()) &&
    /^\d{3,4}$/.test(card.cvc.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || !plan || !valid) return;
    setError(null);

    const raw = card.number.replace(/\s/g, "");
    if (raw.endsWith("0002")) {
      setError("Card declined. Try 4242 4242 4242 4242 for a mock success.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create the account (this is the first time the operator actually
      //    becomes a real user — Custom never reaches this point).
      await register({
        title: resolveTitle(draft),
        firstNames: draft.firstNames,
        lastName: draft.lastName,
        email: draft.email,
        workspaceName: draft.workspaceName,
      });

      // 2. Wire the chosen plan + billing cycle into the workspace subscription.
      await changePlan(plan.id, draft.billingCycle ?? "monthly");

      // 3. Save the mock card so the Billing panel reflects it immediately.
      const [expMonth, expYear] = card.exp.split("/").map((s) => Number(s.trim()));
      await updateMockPaymentMethod({
        brand: detectBrand(raw),
        last4: raw.slice(-4),
        expMonth: expMonth || 1,
        // expYear from "MM/YY" → 20YY
        expYear: expYear ? 2000 + expYear : new Date().getFullYear() + 1,
        holder: card.cardholder.trim(),
      });

      clearRegisterDraft();
      toast.success("Workspace created", {
        description: `${plan.name} plan · 14-day free trial`,
      });
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't complete signup.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!draft || !plan) {
    return (
      <AuthCard eyebrow="Step 3 of 3" title="Add a payment method.">
        <div className="text-small">Loading…</div>
      </AuthCard>
    );
  }

  const monthly = gbp(plan.priceMonthly);
  const yearly = gbp(plan.priceYearly);
  const showPrice =
    (draft.billingCycle ?? "monthly") === "yearly" ? yearly : monthly;

  return (
    <AuthCard
      eyebrow="Step 3 of 3"
      title="Add a payment method."
      subtitle="You won't be charged today — your 14-day free trial starts as soon as your workspace is created."
      footer={
        <span>
          <Link href="/register/plan" className="text-ink-3 hover:text-ink">
            ← Change plan
          </Link>
        </span>
      }
    >
      <div className="rounded-lg border border-accent bg-accent-soft px-4 py-3 mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="eyebrow mb-0.5">Selected plan</div>
            <div className="text-[15px] font-medium text-ink">
              {plan.name}{" "}
              <span className="text-ink-2">· {plan.description}</span>
            </div>
          </div>
          <div className="text-right">
            <div
              className="font-serif text-ink"
              style={{ fontSize: 22, fontWeight: 380 }}
            >
              {showPrice}
              <span className="text-small ml-1">
                /{(draft.billingCycle ?? "monthly") === "yearly" ? "yr" : "mo"}
              </span>
            </div>
            <Pill tone="accent" icon="sparkle">
              14-day free trial
            </Pill>
          </div>
        </div>
      </div>

      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="Cardholder name" required>
          <Input
            value={card.cardholder}
            onChange={(e) =>
              setCard({ ...card, cardholder: e.target.value })
            }
            autoComplete="cc-name"
          />
        </Field>
        <Field
          label="Card number"
          required
          hint="Use 4242 4242 4242 4242 for a mock success, 4000 0000 0000 0002 for a mock decline."
        >
          <Input
            value={card.number}
            onChange={(e) => setCard({ ...card, number: e.target.value })}
            placeholder="4242 4242 4242 4242"
            inputMode="numeric"
            autoComplete="cc-number"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Expiration" required>
            <Input
              value={card.exp}
              onChange={(e) => setCard({ ...card, exp: e.target.value })}
              placeholder="MM/YY"
              autoComplete="cc-exp"
            />
          </Field>
          <Field label="CVC" required>
            <Input
              value={card.cvc}
              onChange={(e) => setCard({ ...card, cvc: e.target.value })}
              placeholder="123"
              inputMode="numeric"
              autoComplete="cc-csc"
            />
          </Field>
        </div>

        {error && <div className="text-small text-danger">{error}</div>}

        <Button
          type="submit"
          size="lg"
          iconRight="arrow-right"
          loading={submitting}
          disabled={!valid}
        >
          Start free trial
        </Button>

        <p className="text-micro text-ink-3 text-center inline-flex items-center justify-center gap-1.5">
          <Icon name="shield" size={12} />
          Mocked checkout · no real charge
        </p>
      </form>
    </AuthCard>
  );
}

function detectBrand(num: string): string {
  if (num.startsWith("4")) return "Visa";
  if (/^5[1-5]/.test(num)) return "Mastercard";
  if (/^3[47]/.test(num)) return "Amex";
  return "Card";
}
