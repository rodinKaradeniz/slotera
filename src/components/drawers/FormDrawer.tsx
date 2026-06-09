"use client";

import * as React from "react";
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
  purpose: "intake",
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
  const isEdit = !!initial;
  const { toast } = useToast();
  const [form, setForm] = React.useState<FormTemplateFormValue>(
    initial ? { ...initial } : DEFAULTS,
  );
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (open) setForm(initial ? { ...initial } : DEFAULTS);
  }, [initial, open]);

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Add a form name first");
      return;
    }
    setBusy(true);
    try {
      if (isEdit && initial) {
        const next = await updateForm(initial.id, form);
        onSaved?.(next);
        toast.success("Form updated");
      } else {
        const next = await createForm(form);
        onSaved?.(next);
        toast.success("Form created");
      }
      onClose();
    } catch (err) {
      toast.error("Couldn't save form", {
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
        next.status === "active" ? "Form activated" : "Form deactivated",
      );
    } catch (err) {
      toast.error("Couldn't update form", {
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
      toast.success("Form deleted");
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      toast.error("Couldn't delete form", {
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
      eyebrow={isEdit ? "Edit form" : "New form"}
      title={isEdit ? form.name || "Untitled form" : "Create a form"}
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
        <FormTemplateForm value={form} onChange={setForm} disabled={busy} />

        {isEdit && (
          <div className="mt-4 pt-5 border-t border-line-soft">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="alert" size={14} className="text-danger" />
              <span className="font-medium text-ink">Danger zone</span>
            </div>
            <p className="text-small mb-3">
              Deactivating hides the form from the booking flow; removing
              deletes it permanently.
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
                Remove form
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => !busy && setConfirmDelete(false)}
        onConfirm={remove}
        title={`Delete "${initial?.name ?? "this form"}"?`}
        description="This permanently removes the form. Services it was attached to will no longer ask clients to complete it."
        confirmLabel="Delete form"
        destructive
        busy={busy}
      />
    </DrawerShell>
  );
}
