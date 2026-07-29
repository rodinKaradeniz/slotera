"use client";

import * as React from "react";
import { DrawerShell } from "@/components/ui/DrawerShell";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { createClient, updateClient } from "@/services/clients.service";
import type { Client, ClientInput } from "@/types/client";

export type ClientDrawerProps = {
  open: boolean;
  onClose: () => void;
  initial?: Client | null;
  onSaved?: (client: Client) => void;
};

const EMPTY_CLIENT: ClientInput = {
  name: "",
  email: "",
  phone: "",
  company: "",
  role: "",
  timezone: "",
  address: "",
  vatId: "",
};

function inputFor(client: Client | null | undefined): ClientInput {
  if (!client) return { ...EMPTY_CLIENT };
  return {
    name: client.name,
    email: client.email,
    phone: client.phone ?? "",
    company: client.company ?? "",
    role: client.role ?? "",
    timezone: client.timezone ?? "",
    address: client.address ?? "",
    vatId: client.vatId ?? "",
  };
}

export function ClientDrawer({ open, onClose, initial, onSaved }: ClientDrawerProps) {
  const { toast } = useToast();
  const [form, setForm] = React.useState<ClientInput>(() => inputFor(initial));
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) setForm(inputFor(initial));
  }, [initial, open]);

  const set = <K extends keyof ClientInput>(key: K, value: ClientInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setBusy(true);
    try {
      const normalized: ClientInput = {
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
      };
      const saved = initial
        ? await updateClient(initial.id, normalized)
        : await createClient(normalized);
      onSaved?.(saved);
      toast.success(initial ? "Client updated" : "Client added");
      onClose();
    } catch (error) {
      toast.error("Couldn't save client", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      eyebrow={initial ? "Edit client" : "New client"}
      title={initial ? form.name || "Untitled client" : "Add a client"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} loading={busy}>Save client</Button>
        </>
      }
    >
      <fieldset disabled={busy} className="grid gap-4">
        <Field label="Full name" required>
          <Input value={form.name} onChange={(event) => set("name", event.target.value)} />
        </Field>
        <Field label="Email" required>
          <Input type="email" value={form.email} onChange={(event) => set("email", event.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" optional>
            <Input value={form.phone ?? ""} onChange={(event) => set("phone", event.target.value)} />
          </Field>
          <Field label="Company" optional>
            <Input value={form.company ?? ""} onChange={(event) => set("company", event.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role" optional>
            <Input value={form.role ?? ""} onChange={(event) => set("role", event.target.value)} />
          </Field>
          <Field label="Timezone" optional>
            <Input value={form.timezone ?? ""} onChange={(event) => set("timezone", event.target.value)} placeholder="Europe/Berlin" />
          </Field>
        </div>
        <Field label="Address" optional>
          <Textarea rows={3} value={form.address ?? ""} onChange={(event) => set("address", event.target.value)} />
        </Field>
        <Field label="VAT ID" optional>
          <Input value={form.vatId ?? ""} onChange={(event) => set("vatId", event.target.value)} />
        </Field>
      </fieldset>
    </DrawerShell>
  );
}
