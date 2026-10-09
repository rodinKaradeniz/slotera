"use client";

import * as React from "react";
import { DrawerShell } from "@/components/ui/DrawerShell";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  provisionWorkspace,
  setInquiryRead,
  type ProvisionWorkspaceInput,
} from "@/services/platform.service";
import { slugify } from "@/lib/text";
import type { PlatformWorkspace } from "@/types/platform";
import { CURRENCIES, type Currency } from "@/types/common";

/**
 * Slotera-staff drawer for provisioning a workspace. Used by:
 *   • /superadmin/workspaces — "New workspace" button (blank initial state)
 *   • /superadmin/inquiries  — "Promote to workspace" action on business
 *     inquiries (pre-fills name/owner from the inquiry and, on save, also
 *     marks the inquiry as read).
 */
export type NewWorkspaceDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** When present, the inquiry is marked read after a successful save. */
  fromInquiryId?: string;
  initial?: {
    name?: string;
    ownerName?: string;
    ownerEmail?: string;
  };
  onCreated?: (workspace: PlatformWorkspace) => void;
};

type ApiFormState = {
  name: string;
  slug: string;
  ownerFirstNames: string;
  ownerLastName: string;
  ownerEmail: string;
  timezone: string;
  currency: Currency;
};

function makeApiForm(initial?: NewWorkspaceDrawerProps["initial"]): ApiFormState {
  const names = (initial?.ownerName ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    name: initial?.name ?? "",
    slug: initial?.name ? slugify(initial.name) : "",
    ownerFirstNames: names.slice(0, -1).join(" ") || names[0] || "",
    ownerLastName: names.length > 1 ? names[names.length - 1] : "",
    ownerEmail: initial?.ownerEmail ?? "",
    timezone: "Europe/London",
    currency: "GBP",
  };
}

export function NewWorkspaceDrawer({
  open,
  onClose,
  fromInquiryId,
  initial,
  onCreated,
}: NewWorkspaceDrawerProps) {
  const { toast } = useToast();
  const [apiForm, setApiForm] = React.useState<ApiFormState>(() => makeApiForm(initial));
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) setApiForm(makeApiForm(initial));
  }, [open, initial]);

  const apiValid =
    apiForm.name.trim().length > 1 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(apiForm.slug) &&
    apiForm.slug.length >= 3 &&
    apiForm.ownerFirstNames.trim().length > 0 &&
    apiForm.ownerLastName.trim().length > 0 &&
    apiForm.ownerEmail.trim().includes("@");

  const save = async () => {
    if (!apiValid) return;
    setBusy(true);
    try {
      const workspace = await provisionWorkspace(apiForm satisfies ProvisionWorkspaceInput);
      if (fromInquiryId) await setInquiryRead(fromInquiryId, true);
      toast.success("Workspace provisioned", {
        description: "The owner has been emailed a link to set their password.",
      });
      onCreated?.(workspace);
      onClose();
    } catch (err) {
      toast.error("Couldn't create workspace", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      eyebrow={fromInquiryId ? "Promote inquiry" : "Provision workspace"}
      title={apiForm.name.trim() || "New workspace"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={!apiValid}>
            Provision workspace
          </Button>
        </>
      }
    >
      <fieldset disabled={busy} className="flex flex-col gap-5 disabled:opacity-90">
        <Field label="Workspace name" required>
          <Input
            value={apiForm.name}
            onChange={(event) =>
              setApiForm({ ...apiForm, name: event.target.value })
            }
            placeholder="e.g. North Star Coaching"
          />
        </Field>
        <Field label="Workspace slug" required hint="Lowercase letters, numbers, and hyphens.">
          <Input
            value={apiForm.slug}
            onChange={(event) =>
              setApiForm({ ...apiForm, slug: event.target.value.toLowerCase() })
            }
            placeholder="north-star-coaching"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Owner first names" required>
            <Input
              value={apiForm.ownerFirstNames}
              onChange={(event) =>
                setApiForm({ ...apiForm, ownerFirstNames: event.target.value })
              }
            />
          </Field>
          <Field label="Owner last name" required>
            <Input
              value={apiForm.ownerLastName}
              onChange={(event) =>
                setApiForm({ ...apiForm, ownerLastName: event.target.value })
              }
            />
          </Field>
        </div>
        <Field label="Owner email" required>
          <Input
            type="email"
            value={apiForm.ownerEmail}
            onChange={(event) =>
              setApiForm({ ...apiForm, ownerEmail: event.target.value })
            }
            autoComplete="email"
          />
        </Field>
        <Field label="Workspace timezone" required>
          <Input
            value={apiForm.timezone}
            onChange={(event) =>
              setApiForm({ ...apiForm, timezone: event.target.value })
            }
            placeholder="Europe/London"
          />
        </Field>
        <Field label="Client currency" required>
          <Select
            value={apiForm.currency}
            onChange={(event) =>
              setApiForm({ ...apiForm, currency: event.target.value as Currency })
            }
            options={[...CURRENCIES]}
          />
        </Field>
        <div className="rounded-md border border-line-soft bg-paper-2 px-3 py-2.5 text-small">
          This creates the workspace on the Free plan and emails the owner a link to set their
          password.
        </div>
      </fieldset>
    </DrawerShell>
  );
}
