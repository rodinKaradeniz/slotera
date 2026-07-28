"use client";

import * as React from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { Address } from "@/types/address";

/**
 * Controlled fields for a structured postal address. Used by the workspace
 * Locations CRUD in Settings → Business Profile and by SessionDrawer's
 * address picker. The caller owns persistence; this component renders fields
 * only.
 *
 * Field order mirrors the public booking-flow billing-address step so the
 * mental model stays consistent across surfaces.
 */
type Props = {
  value: Address;
  onChange: (next: Address) => void;
  disabled?: boolean;
  /** When true, show the operator-only notes textarea (default true). */
  showNotes?: boolean;
};

// Same minimal set the public booking flow uses. Stays small so the dropdown
// doesn't dominate the form.
const COUNTRY_OPTIONS = [
  { value: "DE", label: "🇩🇪  Germany" },
  { value: "AT", label: "🇦🇹  Austria" },
  { value: "FR", label: "🇫🇷  France" },
  { value: "NL", label: "🇳🇱  Netherlands" },
  { value: "ES", label: "🇪🇸  Spain" },
  { value: "IT", label: "🇮🇹  Italy" },
  { value: "GB", label: "🇬🇧  United Kingdom" },
];

export function AddressForm({
  value,
  onChange,
  disabled,
  showNotes = true,
}: Props) {
  const update = (patch: Partial<Address>) => onChange({ ...value, ...patch });
  return (
    <fieldset
      disabled={disabled}
      className="flex flex-col gap-4 disabled:opacity-90"
    >
      <Field label="Address line 1" required>
        <Input
          value={value.street}
          onChange={(e) => update({ street: e.target.value })}
          placeholder="Street and number"
        />
      </Field>
      <Field label="Address line 2" optional>
        <Input
          value={value.street2 ?? ""}
          onChange={(e) => update({ street2: e.target.value })}
          placeholder="Unit, suite, apartment, etc."
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="City" required>
          <Input
            value={value.city}
            onChange={(e) => update({ city: e.target.value })}
          />
        </Field>
        <Field label="State / Region" optional>
          <Input
            value={value.region ?? ""}
            onChange={(e) => update({ region: e.target.value })}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Country" required>
          <Select
            value={value.country}
            onChange={(e) => update({ country: e.target.value })}
            options={COUNTRY_OPTIONS}
          />
        </Field>
        <Field label="Postal code" required>
          <Input
            value={value.postalCode}
            onChange={(e) => update({ postalCode: e.target.value })}
          />
        </Field>
      </div>
      {showNotes && (
        <Field
          label="Access notes"
          optional
          hint="Buzzer, floor, parking — anything attendees need to know to find you."
        >
          <Textarea
            value={value.notes ?? ""}
            rows={2}
            onChange={(e) => update({ notes: e.target.value })}
          />
        </Field>
      )}
    </fieldset>
  );
}

/** One-line summary for list rows. Hides empty pieces gracefully. */
export function formatAddressSummary(address: Address): string {
  return [
    address.street,
    [address.postalCode, address.city].filter(Boolean).join(" "),
    address.country,
  ]
    .filter((s) => s && s.trim().length > 0)
    .join(" · ");
}
