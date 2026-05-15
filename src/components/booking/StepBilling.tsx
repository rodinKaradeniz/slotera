"use client";

import * as React from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Pill } from "@/components/ui/Pill";
import { COUNTRIES } from "./types";
import type { BookingDraft } from "./types";

type Billing = BookingDraft["billing"];

type Props = {
  billing: Billing;
  onChange: (next: Billing) => void;
};

export function StepBilling({ billing, onChange }: Props) {
  const update = (patch: Partial<Billing>) => onChange({ ...billing, ...patch });
  const country = COUNTRIES.find((c) => c.code === billing.country) ?? COUNTRIES[0];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2 flex items-center gap-2">
        <Pill tone="accent" icon="user">Individual billing</Pill>
        <span className="text-small">
          {country.vatLabel} ({(country.vat * 100).toFixed(0)}%) applies for {country.name}.
        </span>
      </div>
      <Field label="Country" required>
        <Select
          value={billing.country}
          onChange={(e) => update({ country: e.target.value })}
          options={COUNTRIES.map((c) => ({
            value: c.code,
            label: `${c.flag}  ${c.name}`,
          }))}
        />
      </Field>
      <Field label="Postal code" required>
        <Input
          value={billing.zip}
          onChange={(e) => update({ zip: e.target.value })}
        />
      </Field>
      <Field label="Street and number" required className="sm:col-span-2">
        <Input
          value={billing.street}
          onChange={(e) => update({ street: e.target.value })}
        />
      </Field>
      <Field label="Address line 2" optional className="sm:col-span-2">
        <Input
          value={billing.address2}
          onChange={(e) => update({ address2: e.target.value })}
          placeholder="Apartment, suite, etc."
        />
      </Field>
      <Field label="City" required className="sm:col-span-2">
        <Input
          value={billing.city}
          onChange={(e) => update({ city: e.target.value })}
        />
      </Field>
    </div>
  );
}
