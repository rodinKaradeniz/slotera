"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

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
  const { t: uiText } = useI18n();
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
        <PageHeader eyebrow={uiText("ui.platform")} title={uiText("ui.workspace.not.found")} />
        <Button variant="secondary" onClick={() => router.push("/superadmin/workspaces")}>
          {uiText("ui.all.workspaces")}</Button>
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
        toast.success(uiText("ui.workspace.reactivated"), {
          description: uiText("ui.the.operator.can.sign.in.with.a.new.session"),
        });
      } else {
        toast.info(uiText("ui.workspace.suspended"), {
          description: uiText("ui.existing.operator.sessions.have.been.revoked"),
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : uiText("ui.could.not.update.workspace"));
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
        {uiText("ui.all.workspaces")}</button>

      <PageHeader
        eyebrow={uiText("ui.workspace")}
        title={workspace.name}
        description={`${workspace.ownerName ?? uiText("ui.no.operator")} · ${workspace.ownerEmail ?? uiText("ui.no.owner.email")}`}
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
            <span>{uiText("ui.joined")}{" "}{fmtDate(new Date(workspace.createdAtISO))}</span>
            {closingOn && (
              <Pill tone="danger" icon="trash">
                {uiText("ui.closed.by.operator.deleted")}{fmtDate(closingOn)}
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
              {closingOn ? uiText("ui.cancel.closure") : isSuspended ? uiText("ui.reactivate") : uiText("ui.suspend")}
            </Button>
          </>
        }
      />

      <Card padded={false} className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-line-soft">
          <PadStat label={uiText("ui.bookings")} value={workspace.bookingsCount.toLocaleString()} />
          <PadStat label={uiText("ui.services")} value={String(workspace.servicesCount)} />
          <PadStat label={uiText("ui.clients")} value={String(workspace.clientsCount)} />
          <PadStat label={uiText("ui.sessions")} value={String(workspace.sessionsCount)} />
        </div>
      </Card>

      <ApiDetail workspace={workspace} onBillingSaved={setWorkspace} />

      <ConfirmDialog
        open={confirmStatusChange}
        onClose={() => setConfirmStatusChange(false)}
        onConfirm={handleSuspend}
        title={
          closingOn
            ? uiText("ui.cancel.the.closure")
            : isSuspended
              ? uiText("ui.reactivate.workspace")
              : uiText("ui.suspend.workspace")
        }
        description={
          closingOn
            ? uiText("ui.the.operator.closed.this.workspace.reactivating.it.cancels.the.scheduled.deletion.and.lets")
            : isSuspended
            ? uiText("ui.the.operator.will.be.able.to.sign.in.again.previously.revoked.sessions.stay.revoked")
            : uiText("ui.the.operator.will.lose.access.immediately.and.all.existing.workspace.sessions.will.be.revo")
        }
        confirmLabel={isSuspended ? uiText("ui.reactivate") : uiText("ui.suspend")}
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
  const { t: uiText } = useI18n();
  return (
    <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
      <div className="flex flex-col gap-6">
      <Card padded>
        <h3 className="text-h3 text-ink mb-4" style={{ fontSize: 16 }}>{uiText("ui.workspace.facts")}</h3>
        <div className="grid sm:grid-cols-2 gap-4 text-small">
          <div><div className="eyebrow mb-1">{uiText("ui.slug")}</div><div className="text-ink">{workspace.slug}</div></div>
          <div><div className="eyebrow mb-1">{uiText("ui.timezone")}</div><div className="text-ink">{workspace.timezone}</div></div>
          <div><div className="eyebrow mb-1">{uiText("ui.currency")}</div><div className="text-ink">{workspace.currency}</div></div>
          <div><div className="eyebrow mb-1">{uiText("ui.created")}</div><div className="text-ink">{fmtDate(new Date(workspace.createdAtISO))}</div></div>
        </div>
      </Card>
      <BillingCard workspace={workspace} onSaved={onBillingSaved} />
      </div>
      <OwnerCard workspace={workspace} />
    </div>
  );
}

function OwnerCard({ workspace }: { workspace: PlatformWorkspace }) {
  const { t: uiText } = useI18n();
  return (
    <Card padded={false}>
      <CardHead title={uiText("ui.owner")} />
      <div className="p-2">
        <DetailLine icon="user" label={uiText("ui.name")} value={workspace.ownerName ?? uiText("ui.no.operator")} />
        <DetailLine icon="mail" label={uiText("ui.email")} value={workspace.ownerEmail ?? "—"} />
        <DetailLine icon="calendar" label={uiText("ui.joined")} value={fmtDate(new Date(workspace.createdAtISO))} />
      </div>
    </Card>
  );
}

function PadStat({ label, value }: { label: string; value: string }) {
  return <div className="p-5"><Stat label={label} value={value} /></div>;
}
