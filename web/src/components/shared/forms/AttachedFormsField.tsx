"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { Field } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { listForms, setFormServiceAttachment } from "@/services/forms.service";
import type { FormTemplate } from "@/types/form";

/**
 * Attach/detach active forms to a service. Attachment is single-sourced on
 * `FormTemplate.attachedServiceIds`, so this control persists each toggle
 * immediately via `setFormServiceAttachment` rather than storing a field on the
 * service. Requires a saved service id — hidden during first-time creation.
 */
type Props = {
  serviceId?: string;
  disabled?: boolean;
};

export function AttachedFormsField({ serviceId, disabled }: Props) {
  const { t: uiText } = useI18n();
  const { toast } = useToast();
  const [forms, setForms] = React.useState<FormTemplate[] | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    listForms().then((all) => setForms(all.filter((f) => f.status === "active")));
  }, []);

  if (!serviceId) {
    return (
      <Field label={uiText("ui.attached.forms")}>
        <p className="text-small text-ink-3">
          {uiText("ui.save.this.service.first.then.attach.intake.forms.to.it")}</p>
      </Field>
    );
  }

  const toggle = async (form: FormTemplate) => {
    const attached = !form.attachedServiceIds.includes(serviceId);
    setBusyId(form.id);
    try {
      const next = await setFormServiceAttachment(form.id, serviceId, attached);
      setForms((prev) =>
        (prev ?? []).map((f) => (f.id === next.id ? next : f)),
      );
      toast.success(attached ? uiText("ui.form.attached") : uiText("ui.form.detached"));
    } catch (err) {
      toast.error(uiText("ui.couldn.t.update.form"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Field
      label={uiText("ui.attached.forms")}
      hint={uiText("ui.clients.booking.this.service.complete.these.forms.before.payment")}
    >
      {forms === null ? (
        <p className="text-small text-ink-3">{uiText("ui.loading.forms")}</p>
      ) : forms.length === 0 ? (
        <p className="text-small text-ink-3">
          {uiText("ui.no.active.forms.yet.create.one.under.forms")}</p>
      ) : (
        <div className="flex flex-col gap-1.5 rounded-md border border-line p-2">
          {forms.map((f) => {
            const checked = f.attachedServiceIds.includes(serviceId);
            return (
              <label
                key={f.id}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-surface-warm cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled || busyId === f.id}
                  onChange={() => toggle(f)}
                  className="accent-accent w-4 h-4"
                />
                <span className="text-[14px] text-ink flex-1">{f.name}</span>
              </label>
            );
          })}
        </div>
      )}
    </Field>
  );
}
