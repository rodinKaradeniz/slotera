"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { currentSession } from "@/services/auth.service";
import { closeWorkspace, exportWorkspace } from "@/services/settings.service";

/**
 * Settings → Account: download everything the workspace holds, or close it. Closing
 * takes the booking page offline and signs everyone out at once; the data is deleted
 * 30 days later unless the operator asks Slotera to reopen it.
 */
export function WorkspaceDataCard() {
  const { t: uiText } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const slug = currentSession()?.operator.workspaceSlug ?? "";
  const [busy, setBusy] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [typed, setTyped] = React.useState("");

  const download = async () => {
    setBusy(true);
    try {
      const data = await exportWorkspace();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `slotera-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(uiText("ui.couldn.t.export.your.data"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    if (typed.trim().toLowerCase() !== slug) {
      toast.error(uiText("ui.type.your.booking.page.address.exactly.to.confirm"));
      return;
    }
    setBusy(true);
    try {
      const days = await closeWorkspace(typed);
      toast.success(uiText("ui.workspace.closed"), {
        description: uiText("ui.data.deleted.after", { count: days }),
      });
      router.replace("/login");
    } catch (error) {
      toast.error(uiText("ui.couldn.t.close.the.workspace"), {
        description: error instanceof Error ? error.message : undefined,
      });
      setBusy(false);
    }
  };

  return (
    <Card padded>
      <h2 className="text-h3 text-ink" style={{ fontSize: 18 }}>
        {uiText("ui.your.data")}</h2>
      <p className="text-small mt-1">
        {uiText("ui.download.everything.your.workspace.holds.as.one.json.file.services.sessions.clients.notes.")}</p>
      <div className="mt-4">
        <Button variant="secondary" icon="download" onClick={download} loading={busy && !confirming}>
          {uiText("ui.export.all.workspace.data")}</Button>
      </div>

      <div className="mt-6 pt-6 border-t border-line-soft">
        <h3 className="text-body text-ink font-medium">{uiText("ui.close.workspace")}</h3>
        <p className="text-small mt-1">
          {uiText("ui.your.booking.page.goes.offline.and.you.are.signed.out.straight.away.all.data.is.deleted.pe")}</p>
        <div className="mt-4">
          <Button
            variant="danger"
            icon="trash"
            onClick={() => {
              setTyped("");
              setConfirming(true);
            }}
            disabled={busy || !slug}
          >
            {uiText("ui.close.workspace")}</Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => !busy && setConfirming(false)}
        onConfirm={close}
        title={uiText("ui.close.this.workspace")}
        description={
          <span className="flex flex-col gap-3">
            <span>
              {uiText("ui.clients.can.no.longer.book.and.you.will.be.signed.out.everything.is.deleted.after.30.days.")}<strong>{slug}</strong> {uiText("ui.to.confirm")}</span>
            <Input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={slug}
              aria-label={uiText("ui.type.your.booking.page.address.to.confirm")}
            />
          </span>
        }
        confirmLabel={uiText("ui.close.workspace")}
        destructive
        busy={busy}
      />
    </Card>
  );
}
