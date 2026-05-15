"use client";

import * as React from "react";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { resetPassword } from "@/services/auth.service";

export default function ResetPasswordPage() {
  const [pwd, setPwd] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pwd.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (pwd !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    await resetPassword("mock-token", pwd);
    setLoading(false);
    setDone(true);
  };

  if (done) {
    return (
      <AuthCard title="Password updated." subtitle="You can now sign in with your new password.">
        <div className="flex items-center gap-2 text-small p-3 rounded-md bg-accent-soft text-accent-ink mb-4">
          <Icon name="check" size={14} /> Reset complete.
        </div>
        <Link href="/login">
          <Button size="lg" full iconRight="arrow-right">Back to sign in</Button>
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set a new password."
      subtitle="Choose something at least 10 characters long."
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="New password" required>
          <Input
            type="password"
            icon="lock"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            required
          />
        </Field>
        <Field label="Confirm new password" required>
          <Input
            type="password"
            icon="lock"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </Field>
        {error && <div className="text-small text-danger">{error}</div>}
        <Button type="submit" loading={loading} size="lg" iconRight="arrow-right">
          Update password
        </Button>
      </form>
    </AuthCard>
  );
}
