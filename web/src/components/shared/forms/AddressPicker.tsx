"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { AddressForm } from "./AddressForm";
import { EMPTY_ADDRESS, type Address, type WorkspaceLocation } from "@/types/address";

/**
 * Address picker — combines a saved-location dropdown with an editable
 * AddressForm. Used by ServiceDrawer (default address for a service) and
 * SessionDrawer (per-session address). The caller fetches saved workspace
 * locations and passes them in.
 *
 * The dropdown is purely a "quick fill" tool: picking a saved location copies
 * its fields into the form, after which the operator can edit freely. The
 * resulting `Address` is whatever's in the form, not a reference to the
 * source location.
 */
type Props = {
  /** Current address; undefined means "no address attached". */
  value: Address | undefined;
  onChange: (next: Address | undefined) => void;
  savedLocations: WorkspaceLocation[];
  /** Customise the small inline title above the editor. */
  title?: string;
  /** Customise the tooltip line that explains what this address is for. */
  description?: string;
  /** Hidden state CTA — defaults to "Add address". */
  addLabel?: string;
};

export function AddressPicker({
  value,
  onChange,
  savedLocations,
  title = "Physical address",
  description = "Shown to attendees on the booking confirmation.",
  addLabel = "Add address",
}: Props) {
  // Local "picker" state — which saved location was last applied. Editing any
  // field doesn't reset this, so the dropdown can still show what was picked.
  const [picker, setPicker] = React.useState<string>("");

  const applySaved = (id: string) => {
    setPicker(id);
    if (!id) return;
    const loc = savedLocations.find((l) => l.id === id);
    if (loc) onChange({ ...loc.address });
  };

  if (!value) {
    return (
      <div className="rounded-md border border-dashed border-line bg-paper-2 p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="w-8 h-8 rounded-md bg-paper text-ink-2 flex items-center justify-center shrink-0">
            <Icon name="map-pin" size={14} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-medium text-ink">{title}</div>
            <p className="text-small mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon="plus"
            onClick={() => onChange({ ...EMPTY_ADDRESS })}
          >
            {addLabel}
          </Button>
          {savedLocations.length > 0 && (
            <div className="min-w-[200px] flex-1">
              <Select
                value=""
                onChange={(e) => applySaved(e.target.value)}
                options={[
                  { value: "", label: "Or use a saved location…" },
                  ...savedLocations.map((l) => ({
                    value: l.id,
                    label: l.label,
                  })),
                ]}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-line bg-surface-warm p-4 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[14px] font-medium text-ink">{title}</div>
          <p className="text-small mt-0.5">{description}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon="trash"
          onClick={() => {
            setPicker("");
            onChange(undefined);
          }}
        >
          Remove
        </Button>
      </div>

      {savedLocations.length > 0 && (
        <Field label="Quick fill from saved location" optional>
          <Select
            value={picker}
            onChange={(e) => applySaved(e.target.value)}
            options={[
              { value: "", label: "—" },
              ...savedLocations.map((l) => ({
                value: l.id,
                label: l.label,
              })),
            ]}
          />
        </Field>
      )}

      <AddressForm value={value} onChange={onChange} />
    </div>
  );
}
