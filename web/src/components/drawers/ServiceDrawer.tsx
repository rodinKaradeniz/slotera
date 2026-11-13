"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { useResetOnOpen } from "@/lib/use-reset-on-open";
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
import { getWorkspaceCurrency } from "@/services/settings.service";

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
  confirmationPolicy: "automatic",
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
  const { t: uiText } = useI18n();
  const isEdit = !!initial;
  const { toast } = useToast();
  const [form, setForm] = React.useState<ServiceFormValue>(
    initial ? { ...initial } : DEFAULTS,
  );
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [persistedActive, setPersistedActive] = React.useState(initial?.active ?? true);
  const [deactivation, setDeactivation] = React.useState<"save" | "toggle" | null>(null);
  useResetOnOpen(open, [initial], () => {
    setPersistedActive(initial?.active ?? true);
    setDeactivation(null);
    setConfirmDelete(false);
  });

  useResetOnOpen(open, [initial], () => setForm(initial ? { ...initial } : DEFAULTS));

  React.useEffect(() => {
    // New services inherit the workspace's currency; the API derives it anyway.
    if (!open || initial) return;
    getWorkspaceCurrency()
      .then((currency) => setForm((f) => ({ ...f, currency })))
      .catch(() => undefined);
  }, [initial, open]);

  const save = async (confirmed = false) => {
    if (busy) return;
    if (initial && persistedActive && !(form.active) && !confirmed) {
      setDeactivation("save");
      return;
    }
    setBusy(true);
    try {
      if (isEdit && initial) {
        const next = await updateService(initial.id, form);
        onSaved?.(next);
        toast.success(uiText("ui.service.updated"));
      } else {
        const next = await createService(form);
        onSaved?.(next);
        toast.success(uiText("ui.service.created"));
      }
      onClose();
    } catch (err) {
      toast.error(uiText("ui.couldn.t.save.service"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    if (!initial || busy) return;
    setBusy(true);
    try {
      const next = persistedActive
        ? await deactivateService(initial.id)
        : await activateService(initial.id);
      setPersistedActive(next.active);
      setDeactivation(null);
      onSaved?.(next);
      setForm((f) => ({ ...f, active: next.active }));
      toast.success(
        next.active ? uiText("ui.service.activated") : uiText("ui.service.deactivated"),
      );
    } catch (err) {
      toast.error(uiText("ui.couldn.t.update.service"), {
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
      toast.success(uiText("ui.service.deleted"));
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      toast.error(uiText("ui.couldn.t.delete.service"), {
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
      eyebrow={isEdit ? uiText("ui.edit.service") : uiText("ui.new.service")}
      title={isEdit ? form.name || "Untitled service" : uiText("ui.create.a.service")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {uiText("ui.cancel")}</Button>
          <Button onClick={() => save()} loading={busy}>
            {uiText("ui.save")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <ServiceForm
          value={form}
          onChange={setForm}
          serviceId={initial?.id}
          disabled={busy}
        />

        {isEdit && (
          <div className="mt-4 pt-5 border-t border-line-soft">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="alert" size={14} className="text-danger" />
              <span className="font-medium text-ink">{uiText("ui.danger.zone")}</span>
            </div>
            <p className="text-small mb-3">
              {uiText("ui.deactivating.hides.the.service.removing.deletes.it.permanently")}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => persistedActive ? setDeactivation("toggle") : void toggleActive()}
                disabled={busy}
              >
                {persistedActive ? uiText("ui.deactivate") : uiText("ui.activate")}
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon="trash"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                {uiText("ui.remove.service")}</Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deactivation !== null}
        onClose={() => !busy && setDeactivation(null)}
        onConfirm={() => deactivation === "save" ? save(true) : toggleActive()}
        title={uiText("catalog.deactivate.named", { name: initial?.name ?? "" })}
        description={uiText("catalog.service.deactivate.effects")}
        confirmLabel={uiText("ui.deactivate")}
        destructive
        busy={busy}
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => !busy && setConfirmDelete(false)}
        onConfirm={remove}
        title={uiText("ui.remove.named", { name: initial?.name ?? uiText("ui.service") })}
        description={uiText("catalog.service.delete.effects")}
        confirmLabel={uiText("ui.delete.service")}
        destructive
        busy={busy}
      />
    </DrawerShell>
  );
}
