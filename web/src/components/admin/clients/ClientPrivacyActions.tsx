"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { eraseClient, exportClient } from "@/services/clients.service";
import type { Client } from "@/types/client";

/**
 * Data-protection requests for one client: download everything held about them, or
 * erase them. Erasure keeps booking amounts and payment state for bookkeeping.
 */
export function ClientPrivacyActions({
  client,
  onErased,
}: {
  client: Client;
  onErased: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [typed, setTyped] = React.useState("");

  const download = async () => {
    setBusy(true);
    try {
      const data = await exportClient(client.id);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `client-${client.id}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Couldn't export client data", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const erase = async () => {
    if (typed.trim().toLowerCase() !== client.email.toLowerCase()) {
      toast.error("Type the client's email exactly to confirm.");
      return;
    }
    setBusy(true);
    try {
      await eraseClient(client.id, typed);
      setConfirming(false);
      toast.success("Client erased", {
        description: "Personal details are gone; booking amounts were kept.",
      });
      onErased();
    } catch (error) {
      toast.error("Couldn't erase client", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="md" icon="download" onClick={download} disabled={busy}>
        Download data
      </Button>
      <Button
        variant="ghost"
        size="md"
        icon="trash"
        onClick={() => {
          setTyped("");
          setConfirming(true);
        }}
        disabled={busy}
      >
        Erase client
      </Button>
      <ConfirmDialog
        open={confirming}
        onClose={() => !busy && setConfirming(false)}
        onConfirm={erase}
        title="Erase this client?"
        description={
          <span className="flex flex-col gap-3">
            <span>
              Their name, contact details, billing addresses, notes, form answers and booking
              links are removed permanently. Booking amounts and payment status stay for your
              records. This can&apos;t be undone.
            </span>
            <Input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={client.email}
              aria-label="Type the client's email to confirm"
            />
          </span>
        }
        confirmLabel="Erase permanently"
        destructive
        busy={busy}
      />
    </>
  );
}
