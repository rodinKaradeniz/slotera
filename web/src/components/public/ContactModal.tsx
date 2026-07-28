"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { createInquiry } from "@/services/platform.service";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { PlatformInquiryType } from "@/types/platform";

/**
 * Public contact modal. By default the submission is purely mocked — nothing
 * is stored, nothing is sent. Pass `persist` to route the submission through
 * `createInquiry()` so it shows up in the superadmin Inquiries view (used by
 * the Custom-plan registration path).
 */
type Props = {
  open: boolean;
  onClose: () => void;
  /** When true, the submission is persisted as a `PlatformInquiry`. */
  persist?: boolean;
  /** Override the modal eyebrow + title for caller-specific framing. */
  eyebrow?: string;
  title?: string;
  description?: string;
  /** Pre-fill helpers. */
  presetName?: string;
  presetEmail?: string;
  presetMessage?: string;
  defaultReason?: PlatformInquiryType;
};

type FormState = {
  name: string;
  email: string;
  reason: PlatformInquiryType;
  message: string;
};

function emptyForm(opts: Partial<FormState> = {}): FormState {
  return {
    name: opts.name ?? "",
    email: opts.email ?? "",
    reason: opts.reason ?? "business",
    message: opts.message ?? "",
  };
}

export function ContactModal({
  open,
  onClose,
  persist = false,
  eyebrow,
  title,
  description,
  presetName,
  presetEmail,
  presetMessage,
  defaultReason,
}: Props) {
  const { t } = useI18n();
  const eyebrowText = eyebrow ?? t("contact.eyebrow");
  const titleText = title ?? t("contact.title");
  const descriptionText = description ?? t("contact.description");
  const reasons: { value: PlatformInquiryType; label: string }[] = [
    { value: "business", label: t("contact.reason.business") },
    { value: "development", label: t("contact.reason.development") },
    { value: "feature", label: t("contact.reason.feature") },
    { value: "general", label: t("contact.reason.general") },
  ];
  const [form, setForm] = React.useState<FormState>(() =>
    emptyForm({
      name: presetName,
      email: presetEmail,
      message: presetMessage,
      reason: defaultReason,
    }),
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setForm(
      emptyForm({
        name: presetName,
        email: presetEmail,
        message: presetMessage,
        reason: defaultReason,
      }),
    );
    setSuccess(false);
    setSubmitting(false);
  }, [open, presetName, presetEmail, presetMessage, defaultReason]);

  const valid =
    form.name.trim().length > 0 &&
    form.email.trim().includes("@") &&
    form.message.trim().length > 4;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    try {
      if (persist) {
        await createInquiry({
          name: form.name,
          email: form.email,
          type: form.reason,
          message: form.message,
        });
      } else {
        // Mocked submission — no persistence, just simulated latency.
        await new Promise((r) => setTimeout(r, 600));
      }
      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="block">
          <span className="eyebrow block mb-2">{eyebrowText}</span>
          <span
            className="block font-serif text-ink"
            style={{
              fontSize: 28,
              fontWeight: 380,
              letterSpacing: "-0.015em",
              lineHeight: 1.1,
            }}
          >
            {titleText}
          </span>
          {!success && descriptionText && (
            <span className="block text-body text-ink-2 mt-2">
              {descriptionText}
            </span>
          )}
        </span>
      }
      size="md"
      footer={
        success ? (
          <Button variant="primary" size="md" onClick={onClose}>
            {t("common.close")}
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="md" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              form="contact-form"
              loading={submitting}
              disabled={!valid}
            >
              {t("contact.send")}
            </Button>
          </>
        )
      }
    >
      {success ? (
        <div className="flex flex-col items-center text-center py-6 gap-3">
          <span className="w-12 h-12 rounded-full bg-accent-soft text-accent flex items-center justify-center">
            <Icon name="check" size={22} strokeWidth={2.5} />
          </span>
          <h3 className="text-h3 text-ink">{t("contact.success.title")}</h3>
          <p className="text-body text-ink-3 max-w-sm">
            {persist
              ? t("contact.success.bodyPersist")
              : t("contact.success.body")}
          </p>
        </div>
      ) : (
        <form id="contact-form" onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("contact.field.name")} required>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoComplete="name"
              />
            </Field>
            <Field label={t("contact.field.email")} required>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoComplete="email"
              />
            </Field>
          </div>
          <Field label={t("contact.field.reason")} required>
            <Select
              value={form.reason}
              onChange={(e) =>
                setForm({ ...form, reason: e.target.value as PlatformInquiryType })
              }
              options={reasons}
            />
          </Field>
          <Field label={t("contact.field.message")} required>
            <Textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              rows={5}
              placeholder={t("contact.message.placeholder")}
            />
          </Field>
        </form>
      )}
    </Modal>
  );
}
