"use client";

import * as React from "react";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { isSlugAvailable, register } from "@/services/auth.service";
import { ApiRequestError } from "@/services/_errors";
import { slugify } from "@/lib/text";

type Form = {
  firstNames: string;
  lastName: string;
  email: string;
  workspaceName: string;
  slug: string;
};

const EMPTY: Form = { firstNames: "", lastName: "", email: "", workspaceName: "", slug: "" };

function RegisterForm({ onDone }: { onDone: (email: string) => void }) {
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
      setError("Your booking page address needs at least 3 characters.");
      return;
    }
    setLoading(true);
    try {
      await register(form);
      onDone(form.email.trim());
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "workspace_slug_unavailable") {
        setSlugTaken(true);
      } else {
        setError(err instanceof Error ? err.message : "Sign-up failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name(s)" required>
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

      <Field label="Email" required hint="We'll send a link here to set your password.">
        <Input
          type="email"
          icon="mail"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          autoComplete="email"
          required
        />
      </Field>

      <Field label="Workspace name" required hint="Usually your name or your practice's name.">
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
        label="Booking page address"
        required
        hint={`Clients book at /book/${form.slug || "your-name"}`}
        error={slugTaken ? "That address is already taken. Try another." : undefined}
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

      {error && <div className="text-small text-danger">{error}</div>}
      <Button
        type="submit"
        loading={loading}
        size="lg"
        iconRight="arrow-right"
        disabled={slugTaken}
      >
        Create workspace
      </Button>
      <p className="text-micro text-center">
        Free plan: €0/month + 3% per card payment. Switch to Pro any time.
      </p>
    </form>
  );
}

function CheckInbox({ email }: { email: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-4">
      <div className="w-14 h-14 rounded-full bg-accent-soft text-accent flex items-center justify-center">
        <Icon name="mail" size={24} />
      </div>
      <p className="text-body text-ink-2">
        We sent a link to <strong className="text-ink">{email}</strong>. Open it to set your
        password and finish setting up your workspace.
      </p>
      <p className="text-small">
        Nothing arrived? Check spam, or{" "}
        <Link href="/forgot-password" className="text-ink underline">
          send a new link
        </Link>
        .
      </p>
    </div>
  );
}

export default function RegisterPage() {
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  return (
    <AuthCard
      eyebrow={sentTo ? "Almost there" : "Get started"}
      title={sentTo ? "Check your inbox." : "Create your workspace."}
      subtitle={
        sentTo ? undefined : "Free to start. Your booking page can be live in under 10 minutes."
      }
      footer={
        <span>
          Already on Slotera?{" "}
          <Link href="/login" className="text-ink underline">
            Sign in
          </Link>
        </span>
      }
    >
      {sentTo ? <CheckInbox email={sentTo} /> : <RegisterForm onDone={setSentTo} />}
    </AuthCard>
  );
}
