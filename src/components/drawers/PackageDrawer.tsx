"use client";

import * as React from "react";
import { DrawerShell } from "@/components/ui/DrawerShell";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import {
  PackageForm,
  type PackageFormValue,
} from "@/components/shared/forms/PackageForm";
import {
  createPackage,
  updatePackage,
  deactivatePackage,
  activatePackage,
  removePackage,
} from "@/services/packages.service";
import type { ServicePackage } from "@/types/package";

export type PackageDrawerProps = {
  open: boolean;
  onClose: () => void;
  initial?: ServicePackage | null;
  onSaved?: (p: ServicePackage) => void;
  onRemoved?: (id: string) => void;
};

const DEFAULTS: PackageFormValue = {
  name: "",
  description: "",
  status: "active",
  priceCents: 50000,
  currency: "GBP",
  items: [],
  notes: "",
  featured: false,
};

// Strip generated/timestamp fields off an existing record to seed the form value.
function toFormValue(p: ServicePackage): PackageFormValue {
  const { id: _id, createdAtISO: _c, updatedAtISO: _u, ...rest } = p;
  return rest;
}

export function PackageDrawer({
  open,
  onClose,
  initial,
  onSaved,
  onRemoved,
}: PackageDrawerProps) {
  const isEdit = !!initial;
  const { toast } = useToast();
  const [form, setForm] = React.useState<PackageFormValue>(
    initial ? toFormValue(initial) : DEFAULTS,
  );
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (open) setForm(initial ? toFormValue(initial) : DEFAULTS);
  }, [initial, open]);

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Add a name first");
      return;
    }
    if (form.priceCents < 0) {
      toast.error("Price can't be negative");
      return;
    }
    setBusy(true);
    try {
      if (isEdit && initial) {
        const next = await updatePackage(initial.id, form);
        onSaved?.(next);
        toast.success("Package updated");
      } else {
        const next = await createPackage(form);
        onSaved?.(next);
        toast.success("Package created");
      }
      onClose();
    } catch (err) {
      toast.error("Couldn't save package", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    if (!initial) return;
    setBusy(true);
    try {
      const next =
        initial.status === "active"
          ? await deactivatePackage(initial.id)
          : await activatePackage(initial.id);
      onSaved?.(next);
      setForm((f) => ({ ...f, status: next.status }));
      toast.success(
        next.status === "active" ? "Package activated" : "Package deactivated",
      );
    } catch (err) {
      toast.error("Couldn't update package", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!initial) return;
    setBusy(true);
    try {
      await removePackage(initial.id);
      onRemoved?.(initial.id);
      toast.success("Package deleted");
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      toast.error("Couldn't delete package", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      eyebrow={isEdit ? "Edit package" : "New package"}
      title={isEdit ? form.name || "Untitled package" : "Create a package"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <PackageForm value={form} onChange={setForm} disabled={busy} />

        {isEdit && (
          <div className="mt-4 pt-5 border-t border-line-soft">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="alert" size={14} className="text-danger" />
              <span className="font-medium text-ink">Danger zone</span>
            </div>
            <p className="text-small mb-3">
              Deactivating hides it from the booking hint; removing deletes it
              permanently.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={toggleActive}
                disabled={busy}
              >
                {form.status === "active" ? "Deactivate" : "Activate"}
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon="trash"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                Remove package
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => !busy && setConfirmDelete(false)}
        onConfirm={remove}
        title={`Delete "${initial?.name ?? "this package"}"?`}
        description="This permanently removes the package. Services stay as they are; they just won't be bundled in it anymore."
        confirmLabel="Delete package"
        destructive
        busy={busy}
      />
    </DrawerShell>
  );
}
