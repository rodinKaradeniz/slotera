"use client";

import * as React from "react";
import { DrawerShell } from "@/components/ui/DrawerShell";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  createWorkspace,
  setInquiryRead,
  type CreateWorkspaceInput,
} from "@/services/platform.service";
import type {
  BillingCycle,
  PlanId,
  SubscriptionStatus,
} from "@/types/billing";
import type { Workspace } from "@/types/platform";

/**
 * Slotera-staff drawer for provisioning a workspace. Used by:
 *   • /superadmin/workspaces — "New workspace" button (blank initial state)
 *   • /superadmin/inquiries  — "Promote to workspace" action on business
 *     inquiries (pre-fills name/owner from the inquiry and, on save, also
 *     marks the inquiry as read).
 */
export type NewWorkspaceDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** When present, the inquiry is marked read after a successful save. */
  fromInquiryId?: string;
  initial?: {
    name?: string;
    ownerName?: string;
    ownerEmail?: string;
  };
  onCreated?: (workspace: Workspace) => void;
};

type FormState = {
  name: string;
  ownerName: string;
  ownerEmail: string;
  planId: PlanId;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  seats: number;
  amountPounds: number;
  trialDays: number;
};

const STATUS_OPTIONS: { value: SubscriptionStatus; label: string }[] = [
  { value: "trialing", label: "Trialing" },
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past due" },
  { value: "cancel_scheduled", label: "Cancel scheduled" },
  { value: "cancelled", label: "Cancelled" },
];

const PLAN_OPTIONS: { value: PlanId; label: string }[] = [
  { value: "solo", label: "Solo" },
  { value: "team", label: "Team" },
  { value: "custom", label: "Custom" },
];

const CYCLE_OPTIONS: { value: BillingCycle; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const PLAN_DEFAULTS: Record<
  PlanId,
  { seats: number; amountPounds: number }
> = {
  solo: { seats: 1, amountPounds: 20 },
  team: { seats: 10, amountPounds: 50 },
  custom: { seats: 25, amountPounds: 0 },
};

function makeForm(initial?: NewWorkspaceDrawerProps["initial"]): FormState {
  return {
    name: initial?.name ?? "",
    ownerName: initial?.ownerName ?? "",
    ownerEmail: initial?.ownerEmail ?? "",
    planId: "custom",
    billingCycle: "monthly",
    status: "trialing",
    seats: PLAN_DEFAULTS.custom.seats,
    amountPounds: PLAN_DEFAULTS.custom.amountPounds,
    trialDays: 14,
  };
}

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function nextMonthISO(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

export function NewWorkspaceDrawer({
  open,
  onClose,
  fromInquiryId,
  initial,
  onCreated,
}: NewWorkspaceDrawerProps) {
  const { toast } = useToast();
  const [form, setForm] = React.useState<FormState>(() => makeForm(initial));
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) setForm(makeForm(initial));
  }, [open, initial]);

  const valid =
    form.name.trim().length > 1 &&
    form.ownerName.trim().length > 1 &&
    form.ownerEmail.trim().includes("@");

  const onPlanChange = (planId: PlanId) => {
    const d = PLAN_DEFAULTS[planId];
    setForm((f) => ({
      ...f,
      planId,
      seats: d.seats,
      amountPounds: d.amountPounds,
    }));
  };

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const payload: CreateWorkspaceInput = {
        name: form.name,
        ownerName: form.ownerName,
        ownerEmail: form.ownerEmail,
        planId: form.planId,
        billingCycle: form.billingCycle,
        status: form.status,
        seats: form.seats,
        amountPounds: form.amountPounds,
        trialEndsAtISO:
          form.status === "trialing" ? isoDaysFromNow(form.trialDays) : null,
        nextBillingAtISO:
          form.status === "active" || form.status === "cancel_scheduled"
            ? nextMonthISO()
            : null,
      };
      const ws = await createWorkspace(payload);
      if (fromInquiryId) {
        await setInquiryRead(fromInquiryId, true);
      }
      toast.success("Workspace created", {
        description: `${form.name} · ${form.planId.toUpperCase()} plan`,
      });
      onCreated?.(ws);
      onClose();
    } catch (err) {
      toast.error("Couldn't create workspace", {
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
      eyebrow={fromInquiryId ? "Promote inquiry" : "Provision workspace"}
      title={form.name.trim() || "New workspace"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={!valid}>
            Create workspace
          </Button>
        </>
      }
    >
      <fieldset disabled={busy} className="flex flex-col gap-5 disabled:opacity-90">
        <Field label="Workspace name" required>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Hartmann Strategy"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Owner name" required>
            <Input
              value={form.ownerName}
              onChange={(e) =>
                setForm({ ...form, ownerName: e.target.value })
              }
            />
          </Field>
          <Field label="Owner email" required>
            <Input
              type="email"
              value={form.ownerEmail}
              onChange={(e) =>
                setForm({ ...form, ownerEmail: e.target.value })
              }
              autoComplete="email"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Plan">
            <Select
              value={form.planId}
              onChange={(e) => onPlanChange(e.target.value as PlanId)}
              options={PLAN_OPTIONS}
            />
          </Field>
          <Field label="Billing cycle">
            <Select
              value={form.billingCycle}
              onChange={(e) =>
                setForm({
                  ...form,
                  billingCycle: e.target.value as BillingCycle,
                })
              }
              options={CYCLE_OPTIONS}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Team members"
            hint="999 = unlimited (Custom plans)."
          >
            <Input
              type="number"
              min={1}
              value={String(form.seats)}
              onChange={(e) =>
                setForm({ ...form, seats: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </Field>
          <Field label="Amount" hint="GBP per billing cycle.">
            <Input
              type="number"
              min={0}
              prefix="GBP"
              value={String(form.amountPounds)}
              onChange={(e) =>
                setForm({
                  ...form,
                  amountPounds: Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
          </Field>
        </div>

        <Field label="Status">
          <Select
            value={form.status}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as SubscriptionStatus })
            }
            options={STATUS_OPTIONS}
          />
        </Field>

        {form.status === "trialing" && (
          <Field label="Trial length (days)">
            <Input
              type="number"
              min={1}
              value={String(form.trialDays)}
              onChange={(e) =>
                setForm({
                  ...form,
                  trialDays: Math.max(1, Number(e.target.value) || 14),
                })
              }
            />
          </Field>
        )}

        {fromInquiryId && (
          <div className="rounded-md border border-line-soft bg-paper-2 px-3 py-2.5 text-small">
            On save, this inquiry will be marked <strong>read</strong>.
          </div>
        )}
      </fieldset>
    </DrawerShell>
  );
}
