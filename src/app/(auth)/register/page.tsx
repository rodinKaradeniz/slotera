"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import {
  EMPTY_REGISTER_DRAFT,
  readRegisterDraft,
  writeRegisterDraft,
  type RegisterDraft,
} from "@/lib/register-draft";

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

function RegisterForm() {
  const router = useRouter();

  const [form, setForm] = React.useState<RegisterDraft>(EMPTY_REGISTER_DRAFT);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Resume the draft if the user came back via Back from /register/plan, etc.
  React.useEffect(() => {
    const stored = readRegisterDraft();
    if (stored) setForm({ ...EMPTY_REGISTER_DRAFT, ...stored });
  }, []);

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
    setLoading(true);
    // No account is created here — the draft is staged so /register/plan and
    // /register/payment can decide whether to actually register (Solo/Team)
    // or divert to a Custom-plan inquiry (no account).
    writeRegisterDraft(form);
    router.push("/register/plan");
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <div
        className={`grid gap-4 sm:grid-cols-[120px_1fr_1fr] ${
          form.title === "__other__" ? "sm:grid-cols-[120px_140px_1fr_1fr]" : ""
        }`}
      >
        <Field label="Title">
          <Select
            value={form.title ?? ""}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            options={TITLE_OPTIONS}
          />
        </Field>
        {form.title === "__other__" && (
          <Field label="Custom title">
            <Input
              value={form.customTitle ?? ""}
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
            value={form.businessType}
            onChange={(e) => setForm({ ...form, businessType: e.target.value })}
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
        Choose plan
      </Button>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <AuthCard
      eyebrow="Step 1 of 3"
      title="Create your workspace."
      subtitle="Spin up a booking page in under 10 minutes. Pick your plan next."
      footer={
        <span>
          Already on Slotera?{" "}
          <Link href="/login" className="text-ink underline">
            Sign in
          </Link>
        </span>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
