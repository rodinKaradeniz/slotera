"use client";

import * as React from "react";
import Link from "next/link";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  listPlatformSubscriptions,
  setSubscriptionPlan,
  setSubscriptionStatus,
} from "@/services/platform.service";
import { SUBSCRIPTION_STATUS } from "@/lib/status-maps";
import { gbp } from "@/lib/money";
import { fmtDate } from "@/lib/time";
import type { PlatformSubscription } from "@/types/platform";
import type {
  BillingCycle,
  PlanId,
  SubscriptionStatus,
} from "@/types/billing";

const STATUS_OPTIONS: Array<{ value: "" | SubscriptionStatus; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "trialing", label: "Trialing" },
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past due" },
  { value: "cancel_scheduled", label: "Cancel scheduled" },
  { value: "cancelled", label: "Cancelled" },
];

const PLAN_OPTIONS: Array<{ value: "" | PlanId; label: string }> = [
  { value: "", label: "All plans" },
  { value: "solo", label: "Solo" },
  { value: "team", label: "Team" },
  { value: "custom", label: "Custom" },
];

const CYCLE_OPTIONS: Array<{ value: "" | BillingCycle; label: string }> = [
  { value: "", label: "Any cycle" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export function SubscriptionsView() {
  const [items, setItems] = React.useState<PlatformSubscription[] | null>(null);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<"" | SubscriptionStatus>("");
  const [plan, setPlan] = React.useState<"" | PlanId>("");
  const [cycle, setCycle] = React.useState<"" | BillingCycle>("");

  React.useEffect(() => {
    listPlatformSubscriptions().then(setItems);
  }, []);

  const filtered = React.useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    return items.filter((s) => {
      if (status && s.status !== status) return false;
      if (plan && s.planId !== plan) return false;
      if (cycle && s.billingCycle !== cycle) return false;
      if (!q) return true;
      return s.workspaceName.toLowerCase().includes(q);
    });
  }, [items, query, status, plan, cycle]);

  const refresh = async () => {
    const next = await listPlatformSubscriptions();
    setItems(next);
  };

  const onChangePlan = async (id: string, planId: PlanId) => {
    await setSubscriptionPlan(id, planId);
    refresh();
  };

  const onCancel = async (id: string) => {
    if (!confirm("Cancel this subscription (mock)?")) return;
    await setSubscriptionStatus(id, "cancel_scheduled");
    refresh();
  };

  const onReactivate = async (id: string) => {
    await setSubscriptionStatus(id, "active");
    refresh();
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Platform"
        title="Subscriptions"
        description="Slotera SaaS subscriptions across all workspaces."
        meta={items ? `${items.length} subscriptions` : undefined}
      />

      <div className="grid sm:grid-cols-[1fr_160px_160px_160px] gap-3 mb-4">
        <Input
          icon="search"
          placeholder="Search by workspace…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select
          value={plan}
          onChange={(e) => setPlan(e.target.value as "" | PlanId)}
          options={PLAN_OPTIONS}
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as "" | SubscriptionStatus)}
          options={STATUS_OPTIONS}
        />
        <Select
          value={cycle}
          onChange={(e) => setCycle(e.target.value as "" | BillingCycle)}
          options={CYCLE_OPTIONS}
        />
      </div>

      {!items ? (
        <LoadingRows count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="card"
          title="No subscriptions match"
          body="Try clearing the filters above."
        />
      ) : (
        <Card padded={false}>
          {filtered.map((s) => {
            const meta = SUBSCRIPTION_STATUS[s.status];
            return (
              <div
                key={s.id}
                className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-3 lg:gap-4 items-center px-5 py-4 border-b border-line-soft last:border-b-0"
              >
                <div className="min-w-0">
                  <Link
                    href={`/superadmin/workspaces/${s.workspaceId}`}
                    className="text-[14px] text-ink font-medium truncate hover:underline"
                  >
                    {s.workspaceName}
                  </Link>
                  <div className="text-small">{s.billingCycle === "yearly" ? "Yearly" : "Monthly"} · {gbp(s.amount)}</div>
                </div>
                <div>
                  <Select
                    value={s.planId}
                    onChange={(e) => onChangePlan(s.id, e.target.value as PlanId)}
                    options={[
                      { value: "solo", label: "Solo" },
                      { value: "team", label: "Team" },
                      { value: "custom", label: "Custom" },
                    ]}
                  />
                </div>
                <div>
                  <Pill tone={meta.tone} icon={meta.icon}>{meta.label}</Pill>
                </div>
                <div className="text-small whitespace-nowrap">
                  {s.trialEndsAtISO
                    ? `Trial ends ${fmtDate(new Date(s.trialEndsAtISO), "short")}`
                    : s.nextBillingAtISO
                      ? `Next ${fmtDate(new Date(s.nextBillingAtISO), "short")}`
                      : "—"}
                </div>
                <div>
                  <Pill tone={paymentTone(s.paymentStatus)}>
                    {paymentLabel(s.paymentStatus)}
                  </Pill>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  {s.status === "cancelled" || s.status === "cancel_scheduled" ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="play"
                      onClick={() => onReactivate(s.id)}
                    >
                      Reactivate
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="x"
                      onClick={() => onCancel(s.id)}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="file"
                    onClick={() => alert("Invoice list is mocked — open the workspace detail.")}
                  >
                    Invoices
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}
      <p className="text-small mt-3">
        Subscription actions update local state only. No payment provider is connected.
      </p>
    </PageContainer>
  );
}

function paymentLabel(s: PlatformSubscription["paymentStatus"]): string {
  switch (s) {
    case "paid":
      return "Paid";
    case "pending":
      return "Pending";
    case "past_due":
      return "Past due";
    case "refunded":
      return "Refunded";
    default:
      return "—";
  }
}

function paymentTone(
  s: PlatformSubscription["paymentStatus"],
):
  | "accent"
  | "warning"
  | "danger"
  | "neutral" {
  switch (s) {
    case "paid":
      return "accent";
    case "pending":
      return "warning";
    case "past_due":
      return "danger";
    default:
      return "neutral";
  }
}

export { paymentLabel, paymentTone };
