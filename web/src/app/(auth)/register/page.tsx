"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { isSlugAvailable, register } from "@/services/auth.service";
import { ApiRequestError } from "@/services/_errors";
import { slugify } from "@/lib/text";
import { CURRENCIES, type Currency } from "@/types/common";
import { signupOpen } from "@/lib/env";

type Form = {
  firstNames: string;
  lastName: string;
  email: string;
  workspaceName: string;
  slug: string;
  currency: Currency;
  termsAccepted: boolean;
};

const EMPTY: Form = {
  firstNames: "",
  lastName: "",
  email: "",
  workspaceName: "",
  slug: "",
  currency: "GBP",
  termsAccepted: false,
};

function RegisterForm({ onDone }: { onDone: (email: string) => void }) {
  const { t: uiText } = useI18n();
  const [form, setForm] = React.useState<Form>(EMPTY);
  // The slug follows the workspace name until the operator edits it directly.
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [slugTaken, setSlugTaken] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const checkSlug = async (slug: string) => {
    if (slug.length < 3) return;
    try {
      setSlugTaken(!(await isSlugAvailable(slug)));
    } catch {
      // Availability is advisory; the sign-up request is the real check.
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.slug.length < 3) {
      setError(uiText("auth.slugTooShort"));
      return;
    }
    if (!form.termsAccepted) {
      setError(uiText("auth.termsRequired"));
      return;
    }
    setLoading(true);
    try {
      await register({ ...form, termsAccepted: true });
      onDone(form.email.trim());
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "workspace_slug_unavailable") {
        setSlugTaken(true);
      } else {
        setError(err instanceof Error ? err.message : uiText("ui.sign.up.failed.please.try.again"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={uiText("ui.first.name.s")} required>
          <Input
            value={form.firstNames}
            onChange={(e) => setForm({ ...form, firstNames: e.target.value })}
            autoComplete="given-name"
            required
          />
        </Field>
        <Field label={uiText("ui.last.name")} required>
          <Input
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            autoComplete="family-name"
            required
          />
        </Field>
      </div>

      <Field label={uiText("ui.email")} required hint={uiText("ui.we.ll.send.a.link.here.to.set.your.password")}>
        <Input
          type="email"
          icon="mail"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          autoComplete="email"
          required
        />
      </Field>

      <Field label={uiText("ui.workspace.name")} required hint={uiText("ui.usually.your.name.or.your.practice.s.name")}>
        <Input
          value={form.workspaceName}
          onChange={(e) => {
            const workspaceName = e.target.value;
            setForm({
              ...form,
              workspaceName,
              slug: slugEdited ? form.slug : slugify(workspaceName),
            });
            if (!slugEdited) setSlugTaken(false);
          }}
          onBlur={() => checkSlug(form.slug)}
          required
        />
      </Field>

      <Field
        label={uiText("ui.booking.page.address")}
        required
        hint={uiText("ui.registration.book.at", { slug: form.slug || "your-name" })}
        error={slugTaken ? uiText("ui.that.address.is.already.taken.try.another") : undefined}
      >
        <Input
          value={form.slug}
          onChange={(e) => {
            setSlugEdited(true);
            setSlugTaken(false);
            setForm({ ...form, slug: slugify(e.target.value) });
          }}
          onBlur={() => checkSlug(form.slug)}
          error={slugTaken}
          required
        />
      </Field>

      <Field label={uiText("ui.currency")} hint={uiText("ui.what.you.charge.your.clients.in.it.can.t.be.changed.later")}>
        <Select
          value={form.currency}
          onChange={(e) => setForm({ ...form, currency: e.target.value as Currency })}
          options={[...CURRENCIES]}
        />
      </Field>

      <label className="flex items-start gap-2 text-micro text-ink-2">
        <input
          type="checkbox"
          checked={form.termsAccepted}
          onChange={(e) => setForm({ ...form, termsAccepted: e.target.checked })}
          className="mt-0.5"
          required
        />
        <span>
          {uiText("ui.i.agree.to.the")}{" "}
          <Link href="/terms" target="_blank" className="underline underline-offset-2">
            {uiText("ui.terms")}</Link>
          ,{" "}
          <Link href="/dpa" target="_blank" className="underline underline-offset-2">
            {uiText("ui.data.processing.agreement")}</Link>{" "}
          {uiText("ui.and")}{" "}
          <Link href="/privacy" target="_blank" className="underline underline-offset-2">
            {uiText("ui.privacy.policy")}</Link>
          .
        </span>
      </label>
      {error && <div className="text-small text-danger">{error}</div>}
      <Button
        type="submit"
        loading={loading}
        size="lg"
        iconRight="arrow-right"
        disabled={slugTaken}
      >
        {uiText("ui.create.workspace")}</Button>
      <p className="text-micro text-center">
        {uiText("ui.30.day.free.trial.then.essentials.19.month.or.professional.39.month")}</p>
    </form>
  );
}

function CheckInbox({ email }: { email: string }) {
  const { t: uiText } = useI18n();
  return (
    <div className="flex flex-col items-center text-center gap-3 py-4">
      <div className="w-14 h-14 rounded-full bg-accent-soft text-accent flex items-center justify-center">
        <Icon name="mail" size={24} />
      </div>
      <p className="text-body text-ink-2">
        {uiText("ui.we.sent.a.link.to")}<strong className="text-ink">{email}</strong>{uiText("ui.open.it.to.set.your.password.and.finish.setting.up.your.workspace")}</p>
      <p className="text-small">
        {uiText("ui.nothing.arrived.check.spam.or")}{" "}
        <Link href="/forgot-password" className="text-ink underline">
          {uiText("ui.send.a.new.link")}</Link>
        .
      </p>
    </div>
  );
}

export default function RegisterPage() {
  const { t: uiText } = useI18n();
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  if (!signupOpen) return <InviteOnly />;
  return (
    <AuthCard
      eyebrow={sentTo ? uiText("ui.almost.there") : uiText("ui.get.started")}
      title={sentTo ? uiText("ui.check.your.inbox") : uiText("ui.create.your.workspace")}
      subtitle={
        sentTo
          ? undefined
          : uiText("ui.30.day.free.trial.no.card.needed.your.booking.page.can.be.live.in.under.10.minutes")
      }
      footer={
        <span>
          {uiText("ui.already.on.slotera")}{" "}
          <Link href="/login" className="text-ink underline">
            {uiText("ui.sign.in")}</Link>
        </span>
      }
    >
      {sentTo ? <CheckInbox email={sentTo} /> : <RegisterForm onDone={setSentTo} />}
    </AuthCard>
  );
}

/** Sign-up is closed during the invite-only pilot (NEXT_PUBLIC_SIGNUP_OPEN=false). */
function InviteOnly() {
  const { t: uiText } = useI18n();
  return (
    <AuthCard
      eyebrow={uiText("ui.pilot")}
      title={uiText("ui.sign.up.is.by.invitation.for.now")}
      subtitle="Apply for the pilot and we'll set up your workspace, then email you a link to sign in."
      footer={
        <span>
          {uiText("ui.already.invited")}{" "}
          <Link href="/login" className="text-ink underline">
            {uiText("ui.sign.in")}</Link>
        </span>
      }
    >
      <Link href="/pilot">
        <Button variant="primary" full iconRight="arrow-right">
          {uiText("ui.apply.for.the.pilot")}</Button>
      </Link>
    </AuthCard>
  );
}
