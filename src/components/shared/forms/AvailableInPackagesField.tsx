"use client";

import * as React from "react";
import { Field } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";
import { PACKAGE_KIND } from "@/lib/status-maps";
import {
  listPackagePrograms,
  setPackageServiceAttachment,
} from "@/services/package-programs.service";
import type { PackageProgram } from "@/types/package-program";

/**
 * Attach/detach this service to active packages & programs. The relationship is
 * single-sourced on `PackageProgram.attachedServiceIds` (there is no
 * `Service.packageProgramIds`), so each toggle persists immediately via
 * `setPackageServiceAttachment` rather than writing a field on the service —
 * exactly like `AttachedFormsField`. Requires a saved service id.
 */
type Props = {
  serviceId?: string;
  disabled?: boolean;
};

export function AvailableInPackagesField({ serviceId, disabled }: Props) {
  const { toast } = useToast();
  const [items, setItems] = React.useState<PackageProgram[] | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    listPackagePrograms().then((all) =>
      setItems(all.filter((p) => p.status === "active")),
    );
  }, []);

  if (!serviceId) {
    return (
      <Field label="Available in packages">
        <p className="text-small text-ink-3">
          Save this service first, then add it to packages or programs.
        </p>
      </Field>
    );
  }

  const toggle = async (item: PackageProgram) => {
    const attached = !item.attachedServiceIds.includes(serviceId);
    setBusyId(item.id);
    try {
      const next = await setPackageServiceAttachment(
        item.id,
        serviceId,
        attached,
      );
      setItems((prev) => (prev ?? []).map((p) => (p.id === next.id ? next : p)));
      toast.success(attached ? "Added to package" : "Removed from package");
    } catch (err) {
      toast.error("Couldn't update package", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Field
      label="Available in packages"
      hint="Multi-session offers this service can be booked toward (informational for now)."
    >
      {items === null ? (
        <p className="text-small text-ink-3">Loading packages…</p>
      ) : items.length === 0 ? (
        <p className="text-small text-ink-3">
          No active packages yet. Create one under Packages.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5 rounded-md border border-line p-2">
          {items.map((p) => {
            const checked = p.attachedServiceIds.includes(serviceId);
            return (
              <label
                key={p.id}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-surface-warm cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled || busyId === p.id}
                  onChange={() => toggle(p)}
                  className="accent-accent w-4 h-4"
                />
                <span className="text-[14px] text-ink flex-1">{p.name}</span>
                <Pill tone="neutral">{PACKAGE_KIND[p.kind].label}</Pill>
              </label>
            );
          })}
        </div>
      )}
    </Field>
  );
}
