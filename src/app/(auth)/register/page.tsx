"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { register } from "@/services/auth.service";

const BUSINESS_TYPES = [
  "Consultant / advisor",
  "Coach",
  "Therapist / counselor",
  "Yoga / fitness instructor",
  "Workshop host",
  "Other",
];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = React.useState({
    name: "Lena Hartmann",
    email: "lena@hartmannstrategy.com",
    password: "",
    workspaceName: "Hartmann Strategy",
    type: BUSINESS_TYPES[0],
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    setLoading(true);
    try {
      await register({
        name: form.name,
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
    <AuthCard
      eyebrow="Free 14-day trial"
      title="Create your workspace."
      subtitle="Spin up a booking page in under 10 minutes. No credit card required."
      footer={
        <span>
          Already on Slotera?{" "}
          <Link href="/login" className="text-ink underline">Sign in</Link>
        </span>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="Full name" required>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoComplete="name"
            required
          />
        </Field>
        <Field label="Work email" required>
          <Input
            type="email"
            icon="mail"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            autoComplete="email"
            required
          />
        </Field>
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
        <Field label="Workspace name" required>
          <Input
            value={form.workspaceName}
            onChange={(e) => setForm({ ...form, workspaceName: e.target.value })}
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
        {error && <div className="text-small text-danger">{error}</div>}
        <Button type="submit" loading={loading} size="lg" iconRight="arrow-right">
          Create workspace
        </Button>
      </form>
    </AuthCard>
  );
}
