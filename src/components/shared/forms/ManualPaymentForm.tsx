"use client";

import * as React from "react";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { Toggle } from "@/components/ui/Toggle";

/**
 * Controlled editor for the workspace-wide manual payment instructions.
 *
 * Used by Settings → Client Payments → Manual Payment and the onboarding
 * stepper's payments step. The instructions string is global (one per
 * workspace) — never per service. See CLAUDE.md.
 */
export type ManualPaymentValue = {
  enabled: boolean;
  instructions: string;
};

type Props = {
  value: ManualPaymentValue;
  onChange: (next: ManualPaymentValue) => void;
  disabled?: boolean;
};

const PLACEHOLDER =
  "Bank transfer to:\nYour Business\nIBAN: ...\nBIC: ...\n\nOr Interac e-Transfer to: you@example.com";

export function ManualPaymentForm({ value, onChange, disabled }: Props) {
  return (
    <fieldset disabled={disabled} className="flex flex-col gap-4 disabled:opacity-90">
      <div className="flex items-center justify-between pb-4 border-b border-line-soft">
        <div>
          <div className="text-[14px] font-medium text-ink">
            Offer manual payment at checkout
          </div>
          <div className="text-small">
            Adds a &ldquo;Manual payment&rdquo; option to the public booking flow.
          </div>
        </div>
        <Toggle
          checked={value.enabled}
          onChange={(v) => onChange({ ...value, enabled: v })}
        />
      </div>

      <Field
        label="Payment instructions"
        hint="Plain text. Shown to clients on the payment step and in confirmation emails."
      >
        <Textarea
          value={value.instructions}
          rows={6}
          disabled={!value.enabled}
          placeholder={PLACEHOLDER}
          onChange={(e) => onChange({ ...value, instructions: e.target.value })}
        />
      </Field>
    </fieldset>
  );
}
