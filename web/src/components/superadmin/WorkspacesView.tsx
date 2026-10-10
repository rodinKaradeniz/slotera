"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { EmptyState } from "@/components/shared/EmptyState";
import { NewWorkspaceDrawer } from "./NewWorkspaceDrawer";
import { PlanPills } from "./PlanPills";
import { listWorkspaces } from "@/services/platform.service";
import { WORKSPACE_OPERATIONAL_STATUS } from "@/lib/status-maps";
import { fmtDate } from "@/lib/time";
import type { PlatformWorkspace } from "@/types/platform";

export function WorkspacesView() {
  const router = useRouter();
  const [items, setItems] = React.useState<PlatformWorkspace[] | null>(null);
  const [query, setQuery] = React.useState("");
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  React.useEffect(() => {
    listWorkspaces().then(setItems);
  }, []);

  const filtered = React.useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    return items.filter((workspace) => {
      if (!q) return true;
      return [workspace.name, workspace.ownerName, workspace.ownerEmail]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [items, query]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Platform"
        title="Workspaces"
        description="Provision and browse workspaces, their plan and operating facts."
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

      <div className="mb-4">
        <Input
          icon="search"
          placeholder="Search by name, owner, email…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {!items ? (
        <LoadingRows count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="building"
          title="No workspaces match"
          body="Try clearing the search."
        />
      ) : (
        <Card padded={false}>
          <Directory items={filtered} />
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

function Directory({ items }: { items: PlatformWorkspace[] }) {
  return (
    <>
      <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] px-5 py-3 border-b border-line-soft text-micro uppercase tracking-wide text-ink-3 bg-surface-warm rounded-t-lg">
        <span>Workspace / status · plan</span>
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
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Pill
                tone={WORKSPACE_OPERATIONAL_STATUS[workspace.operationalStatus].tone}
                icon={WORKSPACE_OPERATIONAL_STATUS[workspace.operationalStatus].icon}
              >
                {WORKSPACE_OPERATIONAL_STATUS[workspace.operationalStatus].label}
              </Pill>
              <PlanPills workspace={workspace} />
            </div>
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
