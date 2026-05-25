"use client";

import * as React from "react";
import { DrawerShell } from "@/components/ui/DrawerShell";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import {
  ServiceForm,
  type ServiceFormValue,
} from "@/components/shared/forms/ServiceForm";
import {
  createService,
  updateService,
  deactivateService,
  activateService,
  removeService,
} from "@/services/services.service";
import type { Service } from "@/types/service";

export type ServiceDrawerProps = {
  open: boolean;
  onClose: () => void;
  initial?: Service | null;
  onSaved?: (s: Service) => void;
  onRemoved?: (id: string) => void;
};

const DEFAULTS: ServiceFormValue = {
  name: "",
  description: "",
  durationMin: 60,
  priceCents: 12000,
  currency: "GBP",
  capacity: 1,
  locationType: "online",
  location: "Zoom · link sent on confirmation",
  bookingMode: "open",
  cancellationRule: "Free reschedule up to 12h before.",
  active: true,
};

export function ServiceDrawer({
  open,
  onClose,
  initial,
  onSaved,
  onRemoved,
}: ServiceDrawerProps) {
  const isEdit = !!initial;
  const { toast } = useToast();
  const [form, setForm] = React.useState<ServiceFormValue>(
    initial ? { ...initial } : DEFAULTS,
  );
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (open) setForm(initial ? { ...initial } : DEFAULTS);
  }, [initial, open]);

  const save = async () => {
    setBusy(true);
    try {
      if (isEdit && initial) {
        const next = await updateService(initial.id, form);
        onSaved?.(next);
        toast.success("Service updated");
      } else {
        const next = await createService(form);
        onSaved?.(next);
        toast.success("Service created");
      }
      onClose();
    } catch (err) {
      toast.error("Couldn't save service", {
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
      const next = initial.active
        ? await deactivateService(initial.id)
        : await activateService(initial.id);
      onSaved?.(next);
      setForm((f) => ({ ...f, active: next.active }));
      toast.success(
        next.active ? "Service activated" : "Service deactivated",
      );
    } catch (err) {
      toast.error("Couldn't update service", {
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
      await removeService(initial.id);
      onRemoved?.(initial.id);
      toast.success("Service deleted");
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      toast.error("Couldn't delete service", {
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
      eyebrow={isEdit ? "Edit service" : "New service"}
      title={isEdit ? form.name || "Untitled service" : "Create a service"}
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
        <ServiceForm value={form} onChange={setForm} disabled={busy} />

        {isEdit && (
          <div className="mt-4 pt-5 border-t border-line-soft">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="alert" size={14} className="text-danger" />
              <span className="font-medium text-ink">Danger zone</span>
            </div>
            <p className="text-small mb-3">
              Deactivating hides the service; removing deletes it permanently.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={toggleActive}
                disabled={busy}
              >
                {form.active ? "Deactivate" : "Activate"}
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon="trash"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                Remove service
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => !busy && setConfirmDelete(false)}
        onConfirm={remove}
        title={`Delete "${initial?.name ?? "this service"}"?`}
        description="This permanently removes the service. Existing sessions and bookings stay on your calendar but new clients can't book it."
        confirmLabel="Delete service"
        destructive
        busy={busy}
      />
    </DrawerShell>
  );
}
