"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

type Props = {
  open: boolean;
  onClose: () => void;
};

const REASONS = [
  { value: "business", label: "Business inquiry" },
  { value: "dev", label: "Development issue" },
  { value: "feature", label: "Feature request" },
  { value: "other", label: "General request" },
];

type FormState = {
  name: string;
  email: string;
  reason: string;
  message: string;
};

const EMPTY: FormState = {
  name: "",
  email: "",
  reason: REASONS[0].value,
  message: "",
};

export function ContactModal({ open, onClose }: Props) {
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setSuccess(false);
    setSubmitting(false);
  }, [open]);

  const valid =
    form.name.trim().length > 0 &&
    form.email.trim().includes("@") &&
    form.message.trim().length > 4;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    setSuccess(true);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Get in touch"
      description={
        success
          ? undefined
          : "Business inquiries, development issues, feature requests — drop us a line and we'll get back to you."
      }
      size="md"
      footer={
        success ? (
          <Button variant="primary" size="md" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              form="contact-form"
              loading={submitting}
              disabled={!valid}
            >
              Send message
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
          <h3 className="text-h3 text-ink">Message sent.</h3>
          <p className="text-body text-ink-3 max-w-sm">
            Thanks for reaching out — a teammate will reply within one business
            day. (This is a mocked confirmation — nothing was actually sent.)
          </p>
        </div>
      ) : (
        <form id="contact-form" onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoComplete="name"
              />
            </Field>
            <Field label="Email" required>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoComplete="email"
              />
            </Field>
          </div>
          <Field label="Reason" required>
            <Select
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              options={REASONS}
            />
          </Field>
          <Field label="Message" required>
            <Textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              rows={5}
              placeholder="Tell us what's on your mind…"
            />
          </Field>
        </form>
      )}
    </Modal>
  );
}
