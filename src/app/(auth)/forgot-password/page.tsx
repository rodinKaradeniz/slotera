"use client";

import * as React from "react";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { requestPasswordReset } from "@/services/auth.service";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await requestPasswordReset(email);
    setLoading(false);
    setSent(true);
  };

  if (sent) {
    return (
      <AuthCard
        title="Check your inbox."
        subtitle={
          <>
            We sent a reset link to <span className="text-ink">{email}</span>.
          </>
        }
        footer={
          <span>
            Didn&apos;t get it?{" "}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="text-ink underline"
            >
              Resend
            </button>
            {" · "}
            <Link href="/login" className="text-ink underline">
              Back to sign in
            </Link>
          </span>
        }
      >
        <div className="flex items-center gap-2 text-small p-3 rounded-md bg-accent-soft text-accent-ink">
          <Icon name="check" size={14} /> Reset link sent.
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password."
      subtitle="Enter your account email and we'll send you a reset link."
      footer={
        <Link href="/login" className="text-ink underline">
          Back to sign in
        </Link>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="Email" required>
          <Input
            type="email"
            icon="mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </Field>
        <Button type="submit" loading={loading} size="lg" iconRight="arrow-right">
          Send reset link
        </Button>
      </form>
    </AuthCard>
  );
}
