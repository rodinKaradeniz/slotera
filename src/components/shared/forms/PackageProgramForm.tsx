"use client";

import * as React from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { listServices } from "@/services/services.service";
import type { Currency } from "@/types/common";
import type {
  PackageProgramInput,
  PackageProgramKind,
} from "@/types/package-program";
import type { Service } from "@/types/service";

/**
 * Controlled editor for a package/program. The caller owns state, save plumbing,
 * and footer actions (mirrors `ServiceForm` / `FormTemplateForm`). Renders
 * fields only.
 *
 * Deliberately simple: no checkout, credit ledger, recurring billing, or
 * entitlement rules. `formTemplateIds` is preserved (passed through `value`)
 * but intentionally has no editor here — packages don't manage forms in Phase 1.
 */
export type PackageProgramFormValue = PackageProgramInput;

type Props = {
  value: PackageProgramFormValue;
  onChange: (next: PackageProgramFormValue) => void;
  disabled?: boolean;
};

const KIND_OPTIONS: { value: PackageProgramKind; label: string }[] = [
  { value: "package", label: "Package — a bundle of sessions" },
  { value: "program", label: "Program — a structured offer over time" },
];

export function PackageProgramForm({ value, onChange, disabled }: Props) {
  const [services, setServices] = React.useState<Service[]>([]);

  React.useEffect(() => {
    listServices().then((s) => setServices(s.filter((x) => x.active)));
  }, []);

  const patch = (p: Partial<PackageProgramFormValue>) =>
    onChange({ ...value, ...p });

  const toggleService = (serviceId: string) => {
    const has = value.attachedServiceIds.includes(serviceId);
    patch({
      attachedServiceIds: has
        ? value.attachedServiceIds.filter((id) => id !== serviceId)
        : [...value.attachedServiceIds, serviceId],
    });
  };

  // Optional numeric field helper: empty string clears to undefined.
  const numberOrUndefined = (raw: string): number | undefined => {
    const n = Number(raw);
    return raw.trim() === "" || Number.isNaN(n) ? undefined : Math.max(0, n);
  };

  return (
    <fieldset
      disabled={disabled}
      className="flex flex-col gap-5 disabled:opacity-90"
    >
      <Field label="Name" required>
        <Input
          value={value.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="e.g. 4-Session Coaching Package"
        />
      </Field>

      <Field
        label="Description"
        hint="One short line describing what the package or program includes."
      >
        <Textarea
          value={value.description}
          rows={2}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </Field>

      <Field label="Type">
        <Select
          value={value.kind}
          onChange={(e) =>
            patch({ kind: e.target.value as PackageProgramKind })
          }
          options={KIND_OPTIONS}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Price">
          <Input
            type="number"
            prefix={value.currency}
            value={String(value.priceCents / 100)}
            onChange={(e) =>
              patch({
                priceCents: Math.max(
                  0,
                  Math.round(Number(e.target.value) * 100) || 0,
                ),
              })
            }
            min={0}
          />
        </Field>
        <Field label="Currency">
          <Select
            value={value.currency}
            onChange={(e) => patch({ currency: e.target.value as Currency })}
            options={["EUR", "USD", "GBP"]}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Included sessions" optional>
          <Input
            type="number"
            value={
              value.includedSessionCount != null
                ? String(value.includedSessionCount)
                : ""
            }
            onChange={(e) =>
              patch({ includedSessionCount: numberOrUndefined(e.target.value) })
            }
            min={0}
            placeholder="e.g. 4"
          />
        </Field>
        <Field label="Validity (days)" optional>
          <Input
            type="number"
            value={value.validityDays != null ? String(value.validityDays) : ""}
            onChange={(e) =>
              patch({ validityDays: numberOrUndefined(e.target.value) })
            }
            min={0}
            placeholder="e.g. 90"
          />
        </Field>
      </div>

      <Field
        label="Duration label"
        optional
        hint="Free text shown to clients, e.g. “8 weeks” or “4 sessions”."
      >
        <Input
          value={value.durationLabel ?? ""}
          onChange={(e) =>
            patch({ durationLabel: e.target.value || undefined })
          }
          placeholder="e.g. 8 weeks"
        />
      </Field>

      {/* Attach to services — single-sourced on attachedServiceIds. */}
      <Field
        label="Available with services"
        hint="Which services this package/program can be used with."
      >
        {services.length === 0 ? (
          <p className="text-small text-ink-3">No active services yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5 rounded-md border border-line p-2">
            {services.map((s) => {
              const checked = value.attachedServiceIds.includes(s.id);
              return (
                <label
                  key={s.id}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-surface-warm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleService(s.id)}
                    className="accent-accent w-4 h-4"
                  />
                  <span className="text-[14px] text-ink">{s.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </Field>

      <Field
        label="Internal notes"
        optional
        hint="Only visible to you. Use for delivery notes or context."
      >
        <Textarea
          value={value.notes ?? ""}
          rows={2}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="e.g. Space sessions 2–3 weeks apart."
        />
      </Field>

      <div className="flex items-center justify-between rounded-md border border-line bg-surface-warm p-4">
        <div>
          <div className="text-[14px] font-medium text-ink">Featured</div>
          <div className="text-small">
            Highlight this offer in the catalog and the booking hint.
          </div>
        </div>
        <Toggle
          checked={!!value.featured}
          onChange={(v) => patch({ featured: v })}
        />
      </div>

      <div className="flex items-center justify-between rounded-md border border-line bg-surface-warm p-4">
        <div>
          <div className="text-[14px] font-medium text-ink">
            {value.status === "active" ? "Active" : "Inactive"}
          </div>
          <div className="text-small">
            Inactive packages are hidden from the booking hint.
          </div>
        </div>
        <Toggle
          checked={value.status === "active"}
          onChange={(v) => patch({ status: v ? "active" : "inactive" })}
        />
      </div>
    </fieldset>
  );
}
