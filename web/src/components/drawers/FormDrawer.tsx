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
  FormTemplateForm,
  type FormTemplateFormValue,
} from "@/components/shared/forms/FormTemplateForm";
import {
  createForm,
  updateForm,
  deactivateForm,
  activateForm,
  removeForm,
} from "@/services/forms.service";
import type { FormTemplate } from "@/types/form";

export type FormDrawerProps = {
  open: boolean;
  onClose: () => void;
  initial?: FormTemplate | null;
  onSaved?: (f: FormTemplate) => void;
  onRemoved?: (id: string) => void;
};

const DEFAULTS: FormTemplateFormValue = {
  name: "",
  description: "",
  status: "active",
  fields: [],
  attachedServiceIds: [],
  requiredBeforePayment: true,
};

export function FormDrawer({
  open,
  onClose,
  initial,
  onSaved,
  onRemoved,
}: FormDrawerProps) {
  const { t: uiText } = useI18n();
  const isEdit = !!initial;
  const { toast } = useToast();
  const [form, setForm] = React.useState<FormTemplateFormValue>(
    initial ? { ...initial } : DEFAULTS,
  );
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  useResetOnOpen(open, [initial], () => setForm(initial ? { ...initial } : DEFAULTS));

  const save = async () => {
    if (!form.name.trim()) {
      toast.error(uiText("ui.add.a.form.name.first"));
      return;
    }
    setBusy(true);
    try {
      if (isEdit && initial) {
        const next = await updateForm(initial.id, form);
        onSaved?.(next);
        toast.success(uiText("ui.form.updated"));
      } else {
        const next = await createForm(form);
        onSaved?.(next);
        toast.success(uiText("ui.form.created"));
      }
      onClose();
    } catch (err) {
      toast.error(uiText("ui.couldn.t.save.form"), {
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
          ? await deactivateForm(initial.id)
          : await activateForm(initial.id);
      onSaved?.(next);
      setForm((f) => ({ ...f, status: next.status }));
      toast.success(
        next.status === "active" ? uiText("ui.form.activated") : uiText("ui.form.deactivated"),
      );
    } catch (err) {
      toast.error(uiText("ui.couldn.t.update.form"), {
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
      await removeForm(initial.id);
      onRemoved?.(initial.id);
      toast.success(uiText("ui.form.deleted"));
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      toast.error(uiText("ui.couldn.t.delete.form"), {
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
      eyebrow={isEdit ? uiText("ui.edit.form") : uiText("ui.new.form")}
      title={isEdit ? form.name || "Untitled form" : uiText("ui.create.a.form")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {uiText("ui.cancel")}</Button>
          <Button onClick={save} loading={busy}>
            {uiText("ui.save")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <FormTemplateForm value={form} onChange={setForm} disabled={busy} />

        {isEdit && (
          <div className="mt-4 pt-5 border-t border-line-soft">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="alert" size={14} className="text-danger" />
              <span className="font-medium text-ink">{uiText("ui.danger.zone")}</span>
            </div>
            <p className="text-small mb-3">
              {uiText("ui.deactivating.hides.the.form.from.the.booking.flow.removing.deletes.it.permanently")}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={toggleActive}
                disabled={busy}
              >
                {form.status === "active" ? uiText("ui.deactivate") : uiText("ui.activate")}
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon="trash"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                {uiText("ui.remove.form")}</Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => !busy && setConfirmDelete(false)}
        onConfirm={remove}
        title={uiText("ui.remove.named", { name: initial?.name ?? uiText("ui.form") })}
        description={uiText("ui.this.permanently.removes.the.form.services.it.was.attached.to.will.no.longer.ask.clients.t")}
        confirmLabel={uiText("ui.delete.form")}
        destructive
        busy={busy}
      />
    </DrawerShell>
  );
}
