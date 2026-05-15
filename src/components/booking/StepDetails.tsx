"use client";

import * as React from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { LegalModal } from "./LegalModal";
import type { BookingDraft } from "./types";

type Customer = BookingDraft["customer"];

type Props = {
  customer: Customer;
  onChange: (next: Customer) => void;
};

export function StepDetails({ customer, onChange }: Props) {
  const [legalOpen, setLegalOpen] = React.useState(false);
  const update = (patch: Partial<Customer>) => onChange({ ...customer, ...patch });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" required>
          <Input
            value={customer.firstName}
            onChange={(e) => update({ firstName: e.target.value })}
          />
        </Field>
        <Field label="Last name" required>
          <Input
            value={customer.lastName}
            onChange={(e) => update({ lastName: e.target.value })}
          />
        </Field>
        <Field label="Email" required>
          <Input
            type="email"
            icon="mail"
            value={customer.email}
            onChange={(e) => update({ email: e.target.value })}
          />
        </Field>
        <Field label="Phone" optional>
          <Input
            type="tel"
            icon="phone"
            value={customer.phone}
            onChange={(e) => update({ phone: e.target.value })}
          />
        </Field>
        <Field label="Company" optional className="sm:col-span-2">
          <Input
            value={customer.company}
            onChange={(e) => update({ company: e.target.value })}
          />
        </Field>
        <Field
          label="Anything you'd like to share before the call?"
          optional
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
          I agree to the{" "}
          <button
            type="button"
            className="underline text-ink hover:text-accent"
            onClick={() => setLegalOpen(true)}
          >
            Terms and Privacy Policy
          </button>
          .
        </span>
      </label>

      <LegalModal open={legalOpen} onClose={() => setLegalOpen(false)} />
    </>
  );
}
