"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { setPlatformWorkspaceBilling } from "@/services/platform.service";
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
  React.useEffect(() => setForm(initial), [initial]);
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
      });
      onSaved(saved);
      toast.success("Billing saved", { description: "Recorded in the audit log." });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save billing");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padded>
      <h3 className="text-h3 text-ink mb-1" style={{ fontSize: 16 }}>Billing</h3>
      <p className="text-small mb-4">
        Invoiced by hand until card billing exists. Extend the trial for pilot members.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Plan">
          <Select
            value={form.plan}
            onChange={(event) => setForm({ ...form, plan: event.target.value as PlanId })}
            options={(Object.keys(PLAN_LABEL) as PlanId[]).map((id) => ({
              value: id,
              label: PLAN_LABEL[id],
            }))}
          />
        </Field>
        <Field label="Billed">
          <Select
            value={form.billingInterval}
            onChange={(event) =>
              setForm({ ...form, billingInterval: event.target.value as BillingInterval })
            }
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly" },
            ]}
          />
        </Field>
        <Field label="Trial ends">
          <Input
            type="date"
            required
            value={form.trialEnds}
            onChange={(event) => setForm({ ...form, trialEnds: event.target.value })}
          />
        </Field>
        <Field label="Paid through" optional hint="Leave empty until the first invoice is paid.">
          <Input
            type="date"
            value={form.paidThrough}
            onChange={(event) => setForm({ ...form, paidThrough: event.target.value })}
          />
        </Field>
      </div>
      <div className="mt-5 flex justify-end">
        <Button disabled={!dirty || busy || !form.trialEnds} onClick={save}>
          Save billing
        </Button>
      </div>
    </Card>
  );
}
