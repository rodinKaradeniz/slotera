"use client";
import { translateInterfaceLabel } from "@/lib/i18n";
import { useI18n } from "@/components/i18n/I18nProvider";

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
import { LoadError } from "@/components/shared/LoadError";
import { useLoad } from "@/lib/use-load";
import { EmptyState } from "@/components/shared/EmptyState";
import { NewWorkspaceDrawer } from "./NewWorkspaceDrawer";
import { PlanPills } from "./PlanPills";
import { Pagination } from "@/components/shared/Pagination";
import { listWorkspacePage } from "@/services/platform.service";
import { WORKSPACE_OPERATIONAL_STATUS } from "@/lib/status-maps";
import { fmtDate } from "@/lib/time";
import type { PlatformWorkspace } from "@/types/platform";

export function WorkspacesView() {
  const { t: uiText } = useI18n();
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const [offset, setOffset] = React.useState(0);
  const load = React.useCallback((signal?: AbortSignal) => listWorkspacePage(query, offset, signal), [query, offset]);
  const {data: page, error, reload, loading} = useLoad(load);
  const items = page?.items;
  const filtered = items ?? [];

  return (
    <PageContainer>
      <PageHeader
        title={uiText("ui.workspaces")}
        description={uiText("ui.provision.and.browse.workspaces.their.plan.and.operating.facts")}
        meta={items ? `${page?.total ?? 0} workspaces` : undefined}
        actions={
          <Button
            variant="primary"
            size="md"
            icon="plus"
            onClick={() => setDrawerOpen(true)}
          >
            {uiText("ui.new.workspace")}</Button>
        }
      />

      <div className="mb-4">
        <Input
          icon="search"
          placeholder={uiText("ui.search.by.name.owner.email")}
          value={query}
          onChange={(event) => {setQuery(event.target.value); setOffset(0);}}
        />
      </div>

      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !items ? (
        <LoadingRows count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="building"
          title={uiText("ui.no.workspaces.match")}
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
          reload();
          router.push(`/superadmin/workspaces/${workspace.id}`);
        }}
      />
      {page && <Pagination total={page.total} offset={offset} onChange={setOffset} loading={loading} />}
    </PageContainer>
  );
}

function Directory({ items }: { items: PlatformWorkspace[] }) {
  const { t: uiText, lang } = useI18n();
  return (
    <>
      <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] px-5 py-3 border-b border-line-soft text-micro uppercase tracking-wide text-ink-3 bg-surface-warm rounded-t-lg">
        <span>{uiText("ui.workspace.status.plan")}</span>
        <span>{uiText("ui.owner")}</span>
        <span>{uiText("ui.created")}</span>
        <span>{uiText("ui.services")}</span>
        <span>{uiText("ui.clients")}</span>
        <span>{uiText("ui.activity")}</span>
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
                {translateInterfaceLabel(lang, WORKSPACE_OPERATIONAL_STATUS[workspace.operationalStatus].label)}
              </Pill>
              <PlanPills workspace={workspace} />
            </div>
            <div className="text-small md:hidden truncate">
              {workspace.ownerName ?? uiText("ui.no.operator")}
            </div>
          </div>
          <div className="hidden md:block min-w-0">
            <div className="text-[14px] text-ink truncate">
              {workspace.ownerName ?? uiText("ui.no.operator")}
            </div>
            <div className="text-small truncate">{workspace.ownerEmail ?? "—"}</div>
          </div>
          <div className="text-small whitespace-nowrap">
            {fmtDate(new Date(workspace.createdAtISO), "short")}
          </div>
          <div className="text-small whitespace-nowrap">{workspace.servicesCount}</div>
          <div className="text-small whitespace-nowrap">{workspace.clientsCount}</div>
          <div className="text-small whitespace-nowrap">
            {workspace.bookingsCount} {" "}{uiText("ui.bookings")} · {" "}{workspace.sessionsCount} {uiText("ui.sessions")}</div>
        </Link>
      ))}
    </>
  );
}
