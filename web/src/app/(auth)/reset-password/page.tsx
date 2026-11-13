"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { useHydrated } from "@/lib/use-hydrated";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { resetPassword } from "@/services/auth.service";
import { dataSource } from "@/lib/env";

export default function ResetPasswordPage() {
  const { t: uiText } = useI18n();
  const [pwd, setPwd] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const hydrated = useHydrated();
  const token = hydrated
    ? (new URLSearchParams(window.location.search).get("token") ?? "")
    : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pwd.length < 10) {
      setError(uiText("ui.your.new.password.needs.at.least.10.characters"));
      return;
    }
    if (pwd !== confirm) {
      setError(uiText("ui.passwords.don.t.match"));
      return;
    }
    if (dataSource === "api" && !token) {
      setError(uiText("auth.resetLinkInvalid"));
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token || "mock-token", pwd);
      setDone(true);
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : uiText("ui.the.password.could.not.be.updated"),
      );
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthCard title={uiText("ui.password.updated")} subtitle="You can now sign in with your new password.">
        <div className="flex items-center gap-2 text-small p-3 rounded-md bg-accent-soft text-accent-ink mb-4">
          <Icon name="check" size={14} /> {uiText("ui.reset.complete")}</div>
        <Link href="/login">
          <Button size="lg" full iconRight="arrow-right">{uiText("ui.back.to.sign.in")}</Button>
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={uiText("ui.set.a.new.password")}
      subtitle="Choose something at least 10 characters long."
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label={uiText("ui.new.password")} required>
          <Input
            type="password"
            icon="lock"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            required
          />
        </Field>
        <Field label={uiText("ui.confirm.new.password")} required>
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
          {uiText("ui.update.password")}</Button>
      </form>
    </AuthCard>
  );
}
