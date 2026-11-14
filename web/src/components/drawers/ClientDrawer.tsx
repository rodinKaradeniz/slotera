"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import * as React from "react";
import { useResetOnOpen } from "@/lib/use-reset-on-open";
import { DrawerShell } from "@/components/ui/DrawerShell";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { ClientIdentityFields } from "@/components/shared/forms/ClientIdentityFields";
import { validateClientIdentity } from "@/lib/client-validation";
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
  const { t: uiText } = useI18n();
  const { toast } = useToast();
  const [form, setForm] = React.useState<ClientInput>(() => inputFor(initial));
  const [errors, setErrors] = React.useState<ReturnType<typeof validateClientIdentity>>({});
  const root = React.useRef<HTMLFieldSetElement>(null);
  const [busy, setBusy] = React.useState(false);

  useResetOnOpen(open, [initial], () => { setForm(inputFor(initial)); setErrors({}); });

  const set = <K extends keyof ClientInput>(key: K, value: ClientInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const invalid = validateClientIdentity(form);
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      requestAnimationFrame(() => root.current?.querySelector<HTMLInputElement>("[aria-invalid=true]")?.focus());
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
      toast.success(initial ? uiText("ui.client.updated") : uiText("ui.client.added"));
      onClose();
    } catch (error) {
      toast.error(uiText("ui.couldn.t.save.client"), {
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
      eyebrow={initial ? uiText("ui.edit.client") : uiText("ui.new.client")}
      title={initial ? form.name || "Untitled client" : uiText("ui.add.a.client")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>{uiText("ui.cancel")}</Button>
          <Button onClick={save} loading={busy}>{uiText("ui.save.client")}</Button>
        </>
      }
    >
      <fieldset ref={root} disabled={busy} className="grid gap-4">
        <ClientIdentityFields value={form} onChange={set} errors={errors} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={uiText("ui.role")} optional>
            <Input value={form.role ?? ""} onChange={(event) => set("role", event.target.value)} />
          </Field>
          <Field label={uiText("ui.timezone")} optional>
            <Input value={form.timezone ?? ""} onChange={(event) => set("timezone", event.target.value)} placeholder="Europe/Berlin" />
          </Field>
        </div>
        <Field label={uiText("ui.address")} optional>
          <Textarea rows={3} value={form.address ?? ""} onChange={(event) => set("address", event.target.value)} />
        </Field>
        <Field label={uiText("ui.vat.id")} optional>
          <Input value={form.vatId ?? ""} onChange={(event) => set("vatId", event.target.value)} />
        </Field>
      </fieldset>
    </DrawerShell>
  );
}
