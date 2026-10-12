"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { CardHead } from "@/components/shared/CardHead";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Pill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";
import { Stat } from "@/components/shared/Stat";
import { DetailLine } from "@/components/shared/DetailLine";
import { LoadingRows } from "@/components/shared/LoadingRows";
import { getWorkspace, suspendWorkspace } from "@/services/platform.service";
import { BillingCard } from "./BillingCard";
import { PlanPills } from "./PlanPills";
import { WORKSPACE_OPERATIONAL_STATUS } from "@/lib/status-maps";
import { fmtDate } from "@/lib/time";
import type { PlatformWorkspace } from "@/types/platform";

export function WorkspaceDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [workspace, setWorkspace] = React.useState<PlatformWorkspace | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [confirmStatusChange, setConfirmStatusChange] = React.useState(false);

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

  const isSuspended = workspace.operationalStatus === "suspended";
  const closingOn = workspace.closureRequestedAtISO
    ? new Date(new Date(workspace.closureRequestedAtISO).getTime() + 30 * 86_400_000)
    : null;

  const handleSuspend = async () => {
    setBusy(true);
    try {
      setWorkspace(await suspendWorkspace(workspace.id, !isSuspended));
      setConfirmStatusChange(false);
      if (isSuspended) {
        toast.success("Workspace reactivated", {
          description: "The operator can sign in with a new session.",
        });
      } else {
        toast.info("Workspace suspended", {
          description: "Existing operator sessions have been revoked.",
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update workspace");
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
          <span className="inline-flex items-center gap-2 flex-wrap">
            <Pill
              tone={WORKSPACE_OPERATIONAL_STATUS[workspace.operationalStatus].tone}
              icon={WORKSPACE_OPERATIONAL_STATUS[workspace.operationalStatus].icon}
            >
              {WORKSPACE_OPERATIONAL_STATUS[workspace.operationalStatus].label}
            </Pill>
            <PlanPills workspace={workspace} />
            <span aria-hidden>·</span>
            <span>Joined {fmtDate(new Date(workspace.createdAtISO))}</span>
            {closingOn && (
              <Pill tone="danger" icon="trash">
                Closed by operator · deleted {fmtDate(closingOn)}
              </Pill>
            )}
          </span>
        }
        actions={
          <>
            <Button
              variant={isSuspended ? "primary" : "danger"}
              size="md"
              icon={isSuspended ? "play" : "pause"}
              disabled={busy}
              onClick={() => setConfirmStatusChange(true)}
            >
              {closingOn ? "Cancel closure" : isSuspended ? "Reactivate" : "Suspend"}
            </Button>
          </>
        }
      />

      <Card padded={false} className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-line-soft">
          <PadStat label="Bookings" value={workspace.bookingsCount.toLocaleString()} />
          <PadStat label="Services" value={String(workspace.servicesCount)} />
          <PadStat label="Clients" value={String(workspace.clientsCount)} />
          <PadStat label="Sessions" value={String(workspace.sessionsCount)} />
        </div>
      </Card>

      <ApiDetail workspace={workspace} onBillingSaved={setWorkspace} />

      <ConfirmDialog
        open={confirmStatusChange}
        onClose={() => setConfirmStatusChange(false)}
        onConfirm={handleSuspend}
        title={
          closingOn
            ? "Cancel the closure?"
            : isSuspended
              ? "Reactivate workspace?"
              : "Suspend workspace?"
        }
        description={
          closingOn
            ? "The operator closed this workspace. Reactivating it cancels the scheduled deletion and lets them sign in again."
            : isSuspended
            ? "The operator will be able to sign in again. Previously revoked sessions stay revoked."
            : "The operator will lose access immediately and all existing workspace sessions will be revoked. Workspace data is retained."
        }
        confirmLabel={isSuspended ? "Reactivate" : "Suspend"}
        destructive={!isSuspended}
        busy={busy}
      />
    </PageContainer>
  );
}

function ApiDetail({
  workspace,
  onBillingSaved,
}: {
  workspace: PlatformWorkspace;
  onBillingSaved: (workspace: PlatformWorkspace) => void;
}) {
  return (
    <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
      <div className="flex flex-col gap-6">
      <Card padded>
        <h3 className="text-h3 text-ink mb-4" style={{ fontSize: 16 }}>Workspace facts</h3>
        <div className="grid sm:grid-cols-2 gap-4 text-small">
          <div><div className="eyebrow mb-1">Slug</div><div className="text-ink">{workspace.slug}</div></div>
          <div><div className="eyebrow mb-1">Timezone</div><div className="text-ink">{workspace.timezone}</div></div>
          <div><div className="eyebrow mb-1">Currency</div><div className="text-ink">{workspace.currency}</div></div>
          <div><div className="eyebrow mb-1">Created</div><div className="text-ink">{fmtDate(new Date(workspace.createdAtISO))}</div></div>
        </div>
      </Card>
      <BillingCard workspace={workspace} onSaved={onBillingSaved} />
      </div>
      <OwnerCard workspace={workspace} />
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
