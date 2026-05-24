"use client";

import * as React from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import type { Service } from "@/types/service";
import type { Currency, LocationType } from "@/types/common";

/**
 * Controlled fields for a service (everything except IDs and creation timestamp).
 * Used by both `ServiceDrawer` (admin edit/create) and the onboarding stepper
 * (first-service step) so the field set and validation stay in one place.
 *
 * The caller owns state, save plumbing, footer actions, and any danger-zone
 * controls. This component renders fields only.
 */
export type ServiceFormValue = Omit<Service, "id" | "createdAtISO">;

type Props = {
  value: ServiceFormValue;
  onChange: (next: ServiceFormValue) => void;
  /** Hide the active toggle (e.g. during first-time onboarding). */
  showActiveToggle?: boolean;
  disabled?: boolean;
};

export function ServiceForm({
  value,
  onChange,
  showActiveToggle = true,
  disabled,
}: Props) {
  return (
    <fieldset disabled={disabled} className="flex flex-col gap-5 disabled:opacity-90">
      <Field label="Service name" required>
        <Input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="e.g. Strategy Deep Dive"
        />
      </Field>

      <Field label="Description" hint="One short line clients see on the booking page.">
        <Textarea
          value={value.description}
          rows={3}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
        />
      </Field>

      <Field label="Duration (min)">
        <Input
          type="number"
          value={String(value.durationMin)}
          onChange={(e) =>
            onChange({ ...value, durationMin: Number(e.target.value) || 0 })
          }
          min={5}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Price">
          <Input
            type="number"
            prefix={value.currency}
            value={String(value.priceCents / 100)}
            onChange={(e) =>
              onChange({
                ...value,
                priceCents: Math.round(Number(e.target.value) * 100) || 0,
              })
            }
            min={0}
          />
        </Field>
        <Field label="Currency">
          <Select
            value={value.currency}
            onChange={(e) =>
              onChange({ ...value, currency: e.target.value as Currency })
            }
            options={["EUR", "USD", "GBP"]}
          />
        </Field>
      </div>

      <Field label="Capacity" hint="1 for 1:1. Higher for group sessions or workshops.">
        <Input
          type="number"
          value={String(value.capacity)}
          onChange={(e) =>
            onChange({
              ...value,
              capacity: Math.max(1, Number(e.target.value) || 1),
            })
          }
          min={1}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Location type">
          <Select
            value={value.locationType}
            onChange={(e) =>
              onChange({
                ...value,
                locationType: e.target.value as LocationType,
              })
            }
            options={[
              { value: "online", label: "Online" },
              { value: "physical", label: "In person" },
              { value: "hybrid", label: "Hybrid" },
            ]}
          />
        </Field>
        <Field label="Meeting / location">
          <Input
            value={value.location}
            onChange={(e) => onChange({ ...value, location: e.target.value })}
          />
        </Field>
      </div>

      <Field label="Cancellation / reschedule rule">
        <Textarea
          value={value.cancellationRule}
          rows={2}
          onChange={(e) =>
            onChange({ ...value, cancellationRule: e.target.value })
          }
        />
      </Field>

      <Field
        label="Internal notes"
        optional
        hint="Only visible to you. Use for prep instructions, materials, or context."
      >
        <Textarea
          value={value.notes ?? ""}
          rows={3}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          placeholder="e.g. Bring projector + whiteboard markers. Send pre-reads 48h ahead."
        />
      </Field>

      {showActiveToggle && (
        <div className="flex items-center justify-between rounded-md border border-line bg-surface-warm p-4">
          <div>
            <div className="text-[14px] font-medium text-ink">
              {value.active ? "Active" : "Inactive"}
            </div>
            <div className="text-small">
              Inactive services don&apos;t appear on the booking page.
            </div>
          </div>
          <Toggle
            checked={value.active}
            onChange={(v) => onChange({ ...value, active: v })}
          />
        </div>
      )}
    </fieldset>
  );
}
