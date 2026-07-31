"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { CardHead } from "@/components/shared/CardHead";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Pill } from "@/components/ui/Pill";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { Stat } from "@/components/shared/Stat";
import { DetailLine } from "@/components/shared/DetailLine";
import { LoadingRows } from "@/components/shared/LoadingRows";
import {
  getWorkspace,
  setWorkspacePlan,
  suspendWorkspace,
} from "@/services/platform.service";
import { dataSource } from "@/lib/env";
import { PLAN_LABEL, SUBSCRIPTION_STATUS } from "@/lib/status-maps";
import { fmtDate, fmtRelative } from "@/lib/time";
import {
  isMockWorkspace,
  type PlatformWorkspace,
  type Workspace,
} from "@/types/platform";
import type { PlanId } from "@/types/billing";

const PLAN_OPTIONS: Array<{ value: PlanId; label: string }> = [
  { value: "solo", label: "Solo" },
  { value: "team", label: "Team" },
  { value: "custom", label: "Custom" },
];

export function WorkspaceDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const apiMode = dataSource === "api";
  const [workspace, setWorkspace] = React.useState<PlatformWorkspace | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    getWorkspace(id).then((item) => {
      if (!item) {
        setNotFound(true);
        return;
      }
      setWorkspace(item);
    });
  }, [id]);

  if (notFound) {
    return (
      <PageContainer>
        <PageHeader eyebrow="Platform" title="Workspace not found" />
        <Button variant="secondary" onClick={() => router.push("/superadmin/workspaces")}>
          ← All workspaces
        </Button>
      </PageContainer>
    );
  }

  if (!workspace) {
    return (
      <PageContainer>
        <LoadingRows count={3} />
      </PageContainer>
    );
  }

  const mockWorkspace = isMockWorkspace(workspace);
  const subscription = mockWorkspace
    ? SUBSCRIPTION_STATUS[workspace.subscriptionStatus]
    : undefined;

  const handlePlanChange = async (planId: PlanId) => {
    if (!isMockWorkspace(workspace) || planId === workspace.planId) return;
    setBusy(true);
    try {
      setWorkspace(await setWorkspacePlan(workspace.id, planId));
    } finally {
      setBusy(false);
    }
  };

  const handleSuspend = async () => {
    if (!isMockWorkspace(workspace)) return;
    setBusy(true);
    try {
      setWorkspace(await suspendWorkspace(workspace.id, !workspace.suspended));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer>
      <button
        type="button"
        onClick={() => router.push("/superadmin/workspaces")}
        className="text-small text-ink-3 hover:text-ink mb-4 inline-flex items-center gap-1"
      >
        ← All workspaces
      </button>

      <PageHeader
        eyebrow="Workspace"
        title={workspace.name}
        description={`${workspace.ownerName ?? "No operator assigned"} · ${workspace.ownerEmail ?? "No owner email"}`}
        meta={
          mockWorkspace && subscription ? (
            <span className="inline-flex items-center gap-2 flex-wrap">
              <Pill tone="neutral">{PLAN_LABEL[workspace.planId]}</Pill>
              <Pill tone={subscription.tone} icon={subscription.icon}>{subscription.label}</Pill>
              {workspace.suspended && <Pill tone="danger">Suspended</Pill>}
              <span aria-hidden>·</span>
              <span>Joined {fmtDate(new Date(workspace.createdAtISO))}</span>
            </span>
          ) : (
            <span>Joined {fmtDate(new Date(workspace.createdAtISO))} · Read-only platform view</span>
          )
        }
        actions={
          !apiMode && mockWorkspace ? (
            <>
              <Button
                variant="secondary"
                size="md"
                icon="eye"
                onClick={() => toast.info("View-as is a placeholder in this mock build.")}
              >
                View as operator
              </Button>
              <Button
                variant={workspace.suspended ? "primary" : "danger"}
                size="md"
                icon={workspace.suspended ? "play" : "pause"}
                loading={busy}
                onClick={handleSuspend}
              >
                {workspace.suspended ? "Reactivate" : "Suspend"}
              </Button>
            </>
          ) : undefined
        }
      />

      <Card padded={false} className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-line-soft">
          <PadStat label="Bookings" value={workspace.bookingsCount.toLocaleString()} />
          <PadStat label="Services" value={String(workspace.servicesCount)} />
          <PadStat label="Clients" value={String(workspace.clientsCount)} />
          <PadStat
            label={mockWorkspace ? "Last active" : "Sessions"}
            value={mockWorkspace ? fmtRelative(workspace.lastActiveISO) : String(workspace.sessionsCount)}
          />
        </div>
      </Card>

      {mockWorkspace ? (
        <MockDetail
          workspace={workspace}
          busy={busy}
          notes={notes}
          onNotesChange={setNotes}
          onPlanChange={handlePlanChange}
        />
      ) : (
        <ApiDetail workspace={workspace} />
      )}
    </PageContainer>
  );
}

function ApiDetail({ workspace }: { workspace: PlatformWorkspace }) {
  return (
    <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
      <Card padded>
        <h3 className="text-h3 text-ink mb-4" style={{ fontSize: 16 }}>Workspace facts</h3>
        <div className="grid sm:grid-cols-2 gap-4 text-small">
          <div><div className="eyebrow mb-1">Slug</div><div className="text-ink">{workspace.slug}</div></div>
          <div><div className="eyebrow mb-1">Timezone</div><div className="text-ink">{workspace.timezone}</div></div>
          <div><div className="eyebrow mb-1">Currency</div><div className="text-ink">{workspace.currency}</div></div>
          <div><div className="eyebrow mb-1">Created</div><div className="text-ink">{fmtDate(new Date(workspace.createdAtISO))}</div></div>
        </div>
      </Card>
      <OwnerCard workspace={workspace} />
    </div>
  );
}

function MockDetail({
  workspace,
  busy,
  notes,
  onNotesChange,
  onPlanChange,
}: {
  workspace: Workspace;
  busy: boolean;
  notes: string;
  onNotesChange: (notes: string) => void;
  onPlanChange: (planId: PlanId) => Promise<void>;
}) {
  const subscription = SUBSCRIPTION_STATUS[workspace.subscriptionStatus];
  return (
    <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
      <div className="flex flex-col gap-6">
        <Card padded>
          <h3 className="text-h3 text-ink mb-4" style={{ fontSize: 16 }}>Plan & subscription</h3>
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <div className="eyebrow mb-2">Plan</div>
              <Select value={workspace.planId} onChange={(event) => onPlanChange(event.target.value as PlanId)} options={PLAN_OPTIONS} disabled={busy} />
            </div>
            <Pill tone={subscription.tone} icon={subscription.icon}>{subscription.label}</Pill>
          </div>
          <p className="text-small mt-3">Plan changes are mocked — they update local state but do not bill anyone.</p>
        </Card>
        <Card padded={false}>
          <CardHead title="Recent activity" />
          <div className="px-5 py-6 text-small text-ink-3">Activity stream is a placeholder. Wire to platform service once event logging exists.</div>
        </Card>
        <Card padded={false}>
          <CardHead title="Billing history" />
          <div className="px-5 py-6 text-small text-ink-3">Workspace-level billing history will surface here. Mock view: see the operator&apos;s own invoice list under their Settings.</div>
        </Card>
      </div>
      <div className="flex flex-col gap-6 lg:sticky lg:top-24">
        <OwnerCard workspace={workspace} />
        <Card padded>
          <h3 className="text-h3 text-ink mb-2" style={{ fontSize: 16 }}>Admin notes</h3>
          <Textarea value={notes} rows={5} placeholder="Internal notes about this workspace (mock, not persisted)…" onChange={(event) => onNotesChange(event.target.value)} />
        </Card>
      </div>
    </div>
  );
}

function OwnerCard({ workspace }: { workspace: PlatformWorkspace }) {
  return (
    <Card padded={false}>
      <CardHead title="Owner" />
      <div className="p-2">
        <DetailLine icon="user" label="Name" value={workspace.ownerName ?? "No operator assigned"} />
        <DetailLine icon="mail" label="Email" value={workspace.ownerEmail ?? "—"} />
        <DetailLine icon="calendar" label="Joined" value={fmtDate(new Date(workspace.createdAtISO))} />
      </div>
    </Card>
  );
}

function PadStat({ label, value }: { label: string; value: string }) {
  return <div className="p-5"><Stat label={label} value={value} /></div>;
}
