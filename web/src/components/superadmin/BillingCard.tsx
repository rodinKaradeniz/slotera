"use client";
import { useReviewedEdit } from "@/components/shared/use-reviewed-edit";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { getWorkspace, setPlatformWorkspaceBilling } from "@/services/platform.service";
import { PLAN_LABEL, type BillingInterval, type PlanId } from "@/lib/plans";
import type { PlatformWorkspace } from "@/types/platform";

/**
 * Staff record what they invoiced by hand until Stripe Billing exists: the plan, the
 * interval, the trial end (extend it for pilot members) and the paid-through date.
 * Every save is audited. Nothing locks automatically when a date passes.
 */
export function BillingCard({
  workspace,
  onSaved,
}: {
  workspace: PlatformWorkspace;
  onSaved: (workspace: PlatformWorkspace) => void;
}) {
  const { t: uiText } = useI18n();
  const { toast } = useToast();
  const initial = React.useMemo(
    () => ({
      plan: workspace.plan,
      billingInterval: workspace.billingInterval,
      trialEnds: workspace.trialEndsAtISO.slice(0, 10),
      paidThrough: workspace.paidThrough ?? "",
    }),
    [workspace],
  );
  const [form, setForm] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const edit = useReviewedEdit(true, {...workspace, version: workspace.billingVersion},
    async (id) => {const latest = await getWorkspace(id); return latest ? {...latest, version: latest.billingVersion} : null;},
    (latest) => {setForm({plan: latest.plan, billingInterval: latest.billingInterval,
      trialEnds: latest.trialEndsAtISO.slice(0,10), paidThrough: latest.paidThrough ?? ""}); onSaved(latest);});
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const save = async () => {
    setBusy(true);
    try {
      const saved = await setPlatformWorkspaceBilling(workspace.id, {
        plan: form.plan,
        billingInterval: form.billingInterval,
        // End of the chosen day in UTC, so "trial ends 12 Nov" includes the 12th.
        trialEndsAt: `${form.trialEnds}T23:59:59Z`,
        paidThrough: form.paidThrough || null,
      }, edit.version);
      edit.accept({...saved, version: saved.billingVersion}); onSaved(saved);
      toast.success(uiText("ui.billing.saved"), { description: uiText("ui.recorded.in.the.audit.log") });
    } catch (error) {
      edit.onError(error);
      toast.error(error instanceof Error ? error.message : uiText("ui.could.not.save.billing"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padded>
      {edit.notice}
      <h3 className="text-h3 text-ink mb-1" style={{ fontSize: 16 }}>{uiText("ui.billing")}</h3>
      <p className="text-small mb-4">
        {uiText("ui.invoiced.by.hand.until.card.billing.exists.extend.the.trial.for.pilot.members")}</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={uiText("ui.plan")}>
          <Select
            value={form.plan}
            onChange={(event) => setForm({ ...form, plan: event.target.value as PlanId })}
            options={(Object.keys(PLAN_LABEL) as PlanId[]).map((id) => ({
              value: id,
              label: PLAN_LABEL[id],
            }))}
          />
        </Field>
        <Field label={uiText("ui.billed")}>
          <Select
            value={form.billingInterval}
            onChange={(event) =>
              setForm({ ...form, billingInterval: event.target.value as BillingInterval })
            }
            options={[
              { value: "monthly", label: uiText("ui.monthly") },
              { value: "yearly", label: uiText("ui.yearly") },
            ]}
          />
        </Field>
        <Field label={uiText("ui.trial.ends")}>
          <Input
            type="date"
            required
            value={form.trialEnds}
            onChange={(event) => setForm({ ...form, trialEnds: event.target.value })}
          />
        </Field>
        <Field label={uiText("ui.paid.through")} optional hint={uiText("ui.leave.empty.until.the.first.invoice.is.paid")}>
          <Input
            type="date"
            value={form.paidThrough}
            onChange={(event) => setForm({ ...form, paidThrough: event.target.value })}
          />
        </Field>
      </div>
      <div className="mt-5 flex justify-end">
        <Button disabled={!dirty || busy || !form.trialEnds} onClick={save}>
          {uiText("ui.save.billing")}</Button>
      </div>
    </Card>
  );
}
