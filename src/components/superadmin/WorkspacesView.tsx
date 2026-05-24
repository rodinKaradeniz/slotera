"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Pill } from "@/components/ui/Pill";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { EmptyState } from "@/components/shared/EmptyState";
import { NewWorkspaceDrawer } from "./NewWorkspaceDrawer";
import { listWorkspaces } from "@/services/platform.service";
import { PLAN_LABEL, SUBSCRIPTION_STATUS } from "@/lib/status-maps";
import { fmtDate, fmtRelative } from "@/lib/time";
import type { Workspace } from "@/types/platform";
import type { PlanId, SubscriptionStatus } from "@/types/billing";

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

export function WorkspacesView() {
  const router = useRouter();
  const [items, setItems] = React.useState<Workspace[] | null>(null);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<"" | SubscriptionStatus>("");
  const [plan, setPlan] = React.useState<"" | PlanId>("");
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  React.useEffect(() => {
    listWorkspaces().then(setItems);
  }, []);

  const filtered = React.useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    return items.filter((w) => {
      if (status && w.subscriptionStatus !== status) return false;
      if (plan && w.planId !== plan) return false;
      if (!q) return true;
      return [w.name, w.ownerName, w.ownerEmail]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [items, query, status, plan]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Platform"
        title="Workspaces"
        description="Every registered Slotera workspace, with plan and subscription status."
        meta={items ? `${items.length} workspaces` : undefined}
        actions={
          <Button
            variant="primary"
            size="md"
            icon="plus"
            onClick={() => setDrawerOpen(true)}
          >
            New workspace
          </Button>
        }
      />

      <div className="grid sm:grid-cols-[1fr_180px_180px] gap-3 mb-4">
        <Input
          icon="search"
          placeholder="Search by name, owner, email…"
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
      </div>

      {!items ? (
        <LoadingRows count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="building"
          title="No workspaces match"
          body="Try clearing search or filters."
        />
      ) : (
        <Card padded={false}>
          <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] px-5 py-3 border-b border-line-soft text-micro uppercase tracking-wide text-ink-3 bg-surface-warm rounded-t-lg">
            <span>Workspace</span>
            <span>Owner</span>
            <span>Plan</span>
            <span>Status</span>
            <span>Created</span>
            <span>Bookings</span>
          </div>
          {filtered.map((w) => {
            const status = SUBSCRIPTION_STATUS[w.subscriptionStatus];
            return (
              <Link
                key={w.id}
                href={`/superadmin/workspaces/${w.id}`}
                className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] gap-2 md:gap-4 items-center px-5 py-3.5 border-b border-line-soft last:border-b-0 hover:bg-surface-warm"
              >
                <div className="min-w-0">
                  <div className="text-[14px] text-ink truncate">{w.name}</div>
                  <div className="text-small md:hidden">{w.ownerName}</div>
                </div>
                <div className="hidden md:block min-w-0">
                  <div className="text-[14px] text-ink truncate">{w.ownerName}</div>
                  <div className="text-small truncate">{w.ownerEmail}</div>
                </div>
                <div>
                  <Pill tone="neutral">{PLAN_LABEL[w.planId]}</Pill>
                </div>
                <div>
                  <Pill tone={status.tone} icon={status.icon}>
                    {status.label}
                  </Pill>
                </div>
                <div className="text-small whitespace-nowrap">
                  {fmtDate(new Date(w.createdAtISO), "short")}
                </div>
                <div className="text-small whitespace-nowrap">
                  {w.bookingsCount.toLocaleString()} · {fmtRelative(w.lastActiveISO)}
                </div>
              </Link>
            );
          })}
        </Card>
      )}

      <NewWorkspaceDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreated={(ws) => {
          listWorkspaces().then(setItems);
          router.push(`/superadmin/workspaces/${ws.id}`);
        }}
      />
    </PageContainer>
  );
}
