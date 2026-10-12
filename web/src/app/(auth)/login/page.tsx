"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { login } from "@/services/auth.service";
import { getBusinessSettings } from "@/services/settings.service";
import type { UserRole } from "@/types/auth";
import { homePathForRole } from "@/lib/nav";
import { useI18n } from "@/components/i18n/I18nProvider";
import { dataSource, signupOpen } from "@/lib/env";

function LoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const nextParam = params?.get("next");
  const next =
    nextParam?.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : null;

  // Prefill demo credentials only in the mock demo and in local API development;
  // a production app login starts empty.
  const [email, setEmail] = React.useState(PREFILL ? "hello@slotera.io" : "");
  const [password, setPassword] = React.useState(
    !PREFILL ? "" : dataSource === "api" ? "slotera-local-only" : "•••••••••",
  );
  const [remember, setRemember] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await login(email, password, remember);
      if (!next && (await needsOnboarding(session.role))) {
        router.push("/onboarding");
        return;
      }
      router.push(next ?? homePathForRole(session.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
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
      <Field label="Password" required>
        <Input
          type="password"
          icon="lock"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </Field>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-small cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 accent-[color:var(--accent)]"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Remember me
        </label>
        {dataSource === "api" && (
          <Link
            href="/forgot-password"
            className="text-small text-ink-2 hover:text-ink underline"
          >
            Forgot password?
          </Link>
        )}
      </div>
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2.5 text-small text-danger"
        >
          <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <Button type="submit" loading={loading} size="lg" iconRight="arrow-right">
        {t("auth.login.submit")}
      </Button>
      {dataSource === "mock" ? (
        <p className="text-micro text-center">
          Demo: any email and password work, or use <code>wrong@example.com</code>{" "}
          to see an error.
        </p>
      ) : PREFILL ? (
        <p className="text-micro text-center">
          Local seed: <code>hello@slotera.io</code> / <code>slotera-local-only</code>
        </p>
      ) : null}
    </form>
  );
}

const PREFILL = dataSource === "mock" || process.env.NODE_ENV !== "production";

/** A newly activated operator lands in onboarding until they finish or skip it. */
async function needsOnboarding(role: UserRole): Promise<boolean> {
  if (dataSource !== "api" || role !== "operator_admin") return false;
  try {
    return !(await getBusinessSettings()).onboardingCompletedAt;
  } catch {
    return false;
  }
}

export default function LoginPage() {
  return (
    <AuthCard
      eyebrow="Operator workspace"
      title="Welcome back."
      subtitle="Sign in to manage bookings, sessions, and clients."
      footer={
        dataSource === "api" ? (
          <span>
            No account yet?{" "}
            <Link href={signupOpen ? "/register" : "/pilot"} className="text-ink underline">
              {signupOpen ? "Start your free trial" : "Join the pilot"}
            </Link>
          </span>
        ) : undefined
      }
    >
      <React.Suspense fallback={null}>
        <LoginForm />
      </React.Suspense>
    </AuthCard>
  );
}
