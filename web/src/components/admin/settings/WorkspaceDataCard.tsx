"use client";

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
      toast.error("Couldn't export your data", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    if (typed.trim().toLowerCase() !== slug) {
      toast.error("Type your booking page address exactly to confirm.");
      return;
    }
    setBusy(true);
    try {
      const days = await closeWorkspace(typed);
      toast.success("Workspace closed", {
        description: `Your data will be deleted in ${days} days.`,
      });
      router.replace("/login");
    } catch (error) {
      toast.error("Couldn't close the workspace", {
        description: error instanceof Error ? error.message : undefined,
      });
      setBusy(false);
    }
  };

  return (
    <Card padded>
      <h2 className="text-h3 text-ink" style={{ fontSize: 18 }}>
        Your data
      </h2>
      <p className="text-small mt-1">
        Download everything your workspace holds as one JSON file: services, sessions,
        clients, notes, bookings and form answers.
      </p>
      <div className="mt-4">
        <Button variant="secondary" icon="download" onClick={download} loading={busy && !confirming}>
          Export all workspace data
        </Button>
      </div>

      <div className="mt-6 pt-6 border-t border-line-soft">
        <h3 className="text-body text-ink font-medium">Close workspace</h3>
        <p className="text-small mt-1">
          Your booking page goes offline and you are signed out straight away. All data is
          deleted permanently after 30 days. Until then, contact us to reopen it. Export
          your data first if you want a copy.
        </p>
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
            Close workspace
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => !busy && setConfirming(false)}
        onConfirm={close}
        title="Close this workspace?"
        description={
          <span className="flex flex-col gap-3">
            <span>
              Clients can no longer book, and you will be signed out. Everything is deleted
              after 30 days. Type your booking page address <strong>{slug}</strong> to
              confirm.
            </span>
            <Input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={slug}
              aria-label="Type your booking page address to confirm"
            />
          </span>
        }
        confirmLabel="Close workspace"
        destructive
        busy={busy}
      />
    </Card>
  );
}
