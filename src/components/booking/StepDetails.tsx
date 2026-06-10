"use client";

import * as React from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { LegalModal } from "./LegalModal";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { BookingDraft } from "./types";

type Customer = BookingDraft["customer"];

type Props = {
  customer: Customer;
  onChange: (next: Customer) => void;
  providerBookingTerms?: {
    enabled: boolean;
    content: string;
  };
};

export function StepDetails({ customer, onChange, providerBookingTerms }: Props) {
  const { t } = useI18n();
  const [legalOpen, setLegalOpen] = React.useState(false);
  const update = (patch: Partial<Customer>) => onChange({ ...customer, ...patch });

  // Consent sentence is a template with a `{terms}` token replaced by the
  // clickable link; split so word order works across languages.
  const consentParts = t("booking.details.consent").split("{terms}");

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("booking.details.firstName")} required>
          <Input
            value={customer.firstName}
            onChange={(e) => update({ firstName: e.target.value })}
          />
        </Field>
        <Field label={t("booking.details.lastName")} required>
          <Input
            value={customer.lastName}
            onChange={(e) => update({ lastName: e.target.value })}
          />
        </Field>
        <Field label={t("booking.details.email")} required>
          <Input
            type="email"
            icon="mail"
            value={customer.email}
            onChange={(e) => update({ email: e.target.value })}
          />
        </Field>
        <Field label={t("booking.details.phone")}>
          <Input
            type="tel"
            icon="phone"
            value={customer.phone}
            onChange={(e) => update({ phone: e.target.value })}
          />
        </Field>
        <Field label={t("booking.details.company")} className="sm:col-span-2">
          <Input
            value={customer.company}
            onChange={(e) => update({ company: e.target.value })}
          />
        </Field>
        <Field
          label={t("booking.details.notes")}
          className="sm:col-span-2"
        >
          <Textarea
            value={customer.notes}
            rows={4}
            onChange={(e) => update({ notes: e.target.value })}
          />
        </Field>
      </div>

      <label className="flex items-start gap-3 mt-6 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5 w-4 h-4 accent-[color:var(--accent)]"
          checked={customer.consent}
          onChange={(e) => update({ consent: e.target.checked })}
        />
        <span className="text-small text-ink-2">
          {consentParts[0]}
          <button
            type="button"
            className="underline text-ink hover:text-accent"
            onClick={() => setLegalOpen(true)}
          >
            {t("booking.details.consentLink")}
          </button>
          {consentParts[1] ?? ""}
        </span>
      </label>

      <LegalModal
        open={legalOpen}
        onClose={() => setLegalOpen(false)}
        providerBookingTerms={providerBookingTerms}
      />
    </>
  );
}
