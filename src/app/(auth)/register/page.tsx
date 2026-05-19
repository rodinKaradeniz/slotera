"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { register } from "@/services/auth.service";
import { listPlans } from "@/services/billing.service";
import { gbp } from "@/lib/money";
import type { PlanId, SubscriptionPlan } from "@/types/billing";

const TITLE_OPTIONS = [
  { value: "", label: "—" },
  { value: "Dr.", label: "Dr." },
  { value: "Mr.", label: "Mr." },
  { value: "Ms.", label: "Ms." },
  { value: "Mrs.", label: "Mrs." },
  { value: "Mx.", label: "Mx." },
  { value: "Prof.", label: "Prof." },
  { value: "__other__", label: "Other" },
];

const BUSINESS_TYPES = [
  "Consultant / advisor",
  "Coach",
  "Therapist / counselor",
  "Yoga / fitness instructor",
  "Workshop host",
  "Other",
];

function isPlanId(v: string | null): v is PlanId {
  return v === "solo" || v === "team" || v === "custom";
}

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const planParam = params?.get("plan");
  const selectedPlanId: PlanId | null = isPlanId(planParam) ? planParam : null;

  const [plan, setPlan] = React.useState<SubscriptionPlan | null>(null);

  React.useEffect(() => {
    if (!selectedPlanId) {
      setPlan(null);
      return;
    }
    listPlans().then((plans) => {
      setPlan(plans.find((p) => p.id === selectedPlanId) ?? null);
    });
  }, [selectedPlanId]);

  const [form, setForm] = React.useState({
    title: "Dr.",
    customTitle: "",
    firstNames: "Lena Maria",
    lastName: "Hartmann",
    email: "lena@hartmannstrategy.com",
    password: "",
    confirmPassword: "",
    workspaceName: "Hartmann Strategy",
    type: BUSINESS_TYPES[0],
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const passwordMismatch =
    form.confirmPassword.length > 0 && form.password !== form.confirmPassword;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    const titleValue =
      form.title === "__other__" ? form.customTitle.trim() : form.title;
    setLoading(true);
    try {
      await register({
        title: titleValue || undefined,
        firstNames: form.firstNames,
        lastName: form.lastName,
        email: form.email,
        workspaceName: form.workspaceName,
      });
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      {plan && <SelectedPlanCard plan={plan} />}

      <div
        className={`grid gap-4 sm:grid-cols-[120px_1fr_1fr] ${
          form.title === "__other__" ? "sm:grid-cols-[120px_140px_1fr_1fr]" : ""
        }`}
      >
        <Field label="Title">
          <Select
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            options={TITLE_OPTIONS}
          />
        </Field>
        {form.title === "__other__" && (
          <Field label="Custom title">
            <Input
              value={form.customTitle}
              onChange={(e) =>
                setForm({ ...form, customTitle: e.target.value })
              }
              placeholder="e.g. Rev."
            />
          </Field>
        )}
        <Field label="Name(s)" required>
          <Input
            value={form.firstNames}
            onChange={(e) => setForm({ ...form, firstNames: e.target.value })}
            autoComplete="given-name"
            required
          />
        </Field>
        <Field label="Last name" required>
          <Input
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            autoComplete="family-name"
            required
          />
        </Field>
      </div>

      <Field label="Email" required>
        <Input
          type="email"
          icon="mail"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          autoComplete="email"
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Password" required hint="At least 10 characters.">
          <Input
            type="password"
            icon="lock"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            autoComplete="new-password"
            required
          />
        </Field>
        <Field
          label="Confirm password"
          required
          error={passwordMismatch ? "Passwords don't match." : undefined}
        >
          <Input
            type="password"
            icon="lock"
            value={form.confirmPassword}
            onChange={(e) =>
              setForm({ ...form, confirmPassword: e.target.value })
            }
            autoComplete="new-password"
            error={passwordMismatch}
            required
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Workspace name" required>
          <Input
            value={form.workspaceName}
            onChange={(e) =>
              setForm({ ...form, workspaceName: e.target.value })
            }
            required
          />
        </Field>
        <Field label="What do you offer?">
          <Select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            options={BUSINESS_TYPES}
          />
        </Field>
      </div>

      {error && <div className="text-small text-danger">{error}</div>}
      <Button
        type="submit"
        loading={loading}
        size="lg"
        iconRight="arrow-right"
        disabled={passwordMismatch}
      >
        Create workspace
      </Button>
    </form>
  );
}

function SelectedPlanCard({ plan }: { plan: SubscriptionPlan }) {
  const monthly = plan.id === "custom" ? "Custom" : gbp(plan.priceMonthly);
  return (
    <div className="rounded-lg border border-accent bg-accent-soft px-4 py-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="eyebrow mb-0.5">Selected plan</div>
          <div className="text-[15px] font-medium text-ink">
            {plan.name} ·{" "}
            <span className="text-ink-2">{plan.description}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-serif text-ink" style={{ fontSize: 22, fontWeight: 380 }}>
            {monthly}
            {plan.id !== "custom" && (
              <span className="text-small ml-1">/mo</span>
            )}
          </div>
          <div className="mt-1">
            <Pill tone="accent" icon="sparkle">14-day free trial · monthly</Pill>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <AuthCard
      eyebrow="Free 14-day trial"
      title="Create your workspace."
      subtitle="Spin up a booking page in under 10 minutes. No credit card required."
      footer={
        <span>
          Already on Slotera?{" "}
          <Link href="/login" className="text-ink underline">
            Sign in
          </Link>
        </span>
      }
    >
      <React.Suspense fallback={null}>
        <RegisterForm />
      </React.Suspense>
    </AuthCard>
  );
}
