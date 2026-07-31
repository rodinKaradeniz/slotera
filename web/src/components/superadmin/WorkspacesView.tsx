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
import { dataSource } from "@/lib/env";
import { PLAN_LABEL, SUBSCRIPTION_STATUS } from "@/lib/status-maps";
import { fmtDate, fmtRelative } from "@/lib/time";
import { isMockWorkspace, type PlatformWorkspace } from "@/types/platform";
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
  const apiMode = dataSource === "api";
  const [items, setItems] = React.useState<PlatformWorkspace[] | null>(null);
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
    return items.filter((workspace) => {
      if (!apiMode && isMockWorkspace(workspace)) {
        if (status && workspace.subscriptionStatus !== status) return false;
        if (plan && workspace.planId !== plan) return false;
      }
      if (!q) return true;
      return [workspace.name, workspace.ownerName, workspace.ownerEmail]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [apiMode, items, plan, query, status]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Platform"
        title="Workspaces"
        description={
          apiMode
            ? "Provision and browse persisted workspaces with display-safe operating facts."
            : "Every registered Slotera workspace, with plan and subscription status."
        }
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

      <div className={`grid gap-3 mb-4 ${apiMode ? "sm:grid-cols-1" : "sm:grid-cols-[1fr_180px_180px]"}`}>
        <Input
          icon="search"
          placeholder="Search by name, owner, email…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {!apiMode && (
          <>
            <Select
              value={plan}
              onChange={(event) => setPlan(event.target.value as "" | PlanId)}
              options={PLAN_OPTIONS}
            />
            <Select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as "" | SubscriptionStatus)
              }
              options={STATUS_OPTIONS}
            />
          </>
        )}
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
          {apiMode ? <ApiDirectory items={filtered} /> : <MockDirectory items={filtered} />}
        </Card>
      )}

      <NewWorkspaceDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreated={(workspace) => {
          listWorkspaces().then(setItems);
          router.push(`/superadmin/workspaces/${workspace.id}`);
        }}
      />
    </PageContainer>
  );
}

function ApiDirectory({ items }: { items: PlatformWorkspace[] }) {
  return (
    <>
      <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] px-5 py-3 border-b border-line-soft text-micro uppercase tracking-wide text-ink-3 bg-surface-warm rounded-t-lg">
        <span>Workspace</span>
        <span>Owner</span>
        <span>Created</span>
        <span>Services</span>
        <span>Clients</span>
        <span>Activity</span>
      </div>
      {items.map((workspace) => (
        <Link
          key={workspace.id}
          href={`/superadmin/workspaces/${workspace.id}`}
          className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] gap-2 md:gap-4 items-center px-5 py-3.5 border-b border-line-soft last:border-b-0 hover:bg-surface-warm"
        >
          <div className="min-w-0">
            <div className="text-[14px] text-ink truncate">{workspace.name}</div>
            <div className="text-small md:hidden truncate">
              {workspace.ownerName ?? "No operator assigned"}
            </div>
          </div>
          <div className="hidden md:block min-w-0">
            <div className="text-[14px] text-ink truncate">
              {workspace.ownerName ?? "No operator assigned"}
            </div>
            <div className="text-small truncate">{workspace.ownerEmail ?? "—"}</div>
          </div>
          <div className="text-small whitespace-nowrap">
            {fmtDate(new Date(workspace.createdAtISO), "short")}
          </div>
          <div className="text-small whitespace-nowrap">{workspace.servicesCount}</div>
          <div className="text-small whitespace-nowrap">{workspace.clientsCount}</div>
          <div className="text-small whitespace-nowrap">
            {workspace.bookingsCount} bookings · {workspace.sessionsCount} sessions
          </div>
        </Link>
      ))}
    </>
  );
}

function MockDirectory({ items }: { items: PlatformWorkspace[] }) {
  return (
    <>
      <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] px-5 py-3 border-b border-line-soft text-micro uppercase tracking-wide text-ink-3 bg-surface-warm rounded-t-lg">
        <span>Workspace</span>
        <span>Owner</span>
        <span>Plan</span>
        <span>Status</span>
        <span>Created</span>
        <span>Bookings</span>
      </div>
      {items.filter(isMockWorkspace).map((workspace) => {
        const subscription = SUBSCRIPTION_STATUS[workspace.subscriptionStatus];
        return (
          <Link
            key={workspace.id}
            href={`/superadmin/workspaces/${workspace.id}`}
            className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] gap-2 md:gap-4 items-center px-5 py-3.5 border-b border-line-soft last:border-b-0 hover:bg-surface-warm"
          >
            <div className="min-w-0">
              <div className="text-[14px] text-ink truncate">{workspace.name}</div>
              <div className="text-small md:hidden">{workspace.ownerName}</div>
            </div>
            <div className="hidden md:block min-w-0">
              <div className="text-[14px] text-ink truncate">{workspace.ownerName}</div>
              <div className="text-small truncate">{workspace.ownerEmail}</div>
            </div>
            <div><Pill tone="neutral">{PLAN_LABEL[workspace.planId]}</Pill></div>
            <div><Pill tone={subscription.tone} icon={subscription.icon}>{subscription.label}</Pill></div>
            <div className="text-small whitespace-nowrap">{fmtDate(new Date(workspace.createdAtISO), "short")}</div>
            <div className="text-small whitespace-nowrap">{workspace.bookingsCount.toLocaleString()} · {fmtRelative(workspace.lastActiveISO)}</div>
          </Link>
        );
      })}
    </>
  );
}
