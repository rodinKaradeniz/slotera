"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AddressForm, formatAddressSummary } from "@/components/shared/forms/AddressForm";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import {
  createWorkspaceLocation,
  deleteWorkspaceLocation,
  updateWorkspaceLocation,
  type BusinessSettings,
} from "@/services/settings.service";
import { EMPTY_ADDRESS, type WorkspaceLocation } from "@/types/address";

/* ──────────────────────────────────────────────────────────────────────────
   LocationsCard — workspace's saved studios/offices.
   Used in Settings → Business Profile. Lets the operator name a place and
   fill its address once, then pick it from a dropdown when scheduling a
   session in SessionDrawer (so they don't retype the address every time).
   ────────────────────────────────────────────────────────────────────────── */
export function LocationsCard({
  business,
  onChange,
}: {
  business: BusinessSettings;
  onChange: (next: BusinessSettings) => void;
}) {
  const { toast } = useToast();
  const locations = business.locations ?? [];
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<WorkspaceLocation | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [pendingDelete, setPendingDelete] =
    React.useState<WorkspaceLocation | null>(null);

  const startNew = () => {
    setDraft({
      id: "",
      label: "",
      address: { ...EMPTY_ADDRESS },
    });
    setEditingId("__new__");
  };

  const startEdit = (loc: WorkspaceLocation) => {
    setDraft({ ...loc, address: { ...loc.address } });
    setEditingId(loc.id);
  };

  const cancelEdit = () => {
    setDraft(null);
    setEditingId(null);
  };

  const save = async () => {
    if (!draft) return;
    if (draft.label.trim().length === 0) {
      toast.error("Give the location a name.");
      return;
    }
    if (draft.address.street.trim().length === 0) {
      toast.error("Address line 1 is required.");
      return;
    }
    const exists = editingId !== "__new__";
    setBusy(true);
    try {
      const saved = exists
        ? await updateWorkspaceLocation(draft.id, {
            label: draft.label,
            address: draft.address,
          })
        : await createWorkspaceLocation({
            label: draft.label,
            address: draft.address,
          });
      const next = exists
        ? locations.map((location) => (location.id === saved.id ? saved : location))
        : [...locations, saved];
      onChange({ ...business, locations: next });
      toast.success(exists ? "Location updated" : "Location added");
      cancelEdit();
    } catch (error) {
      toast.error("Couldn't save location", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (loc: WorkspaceLocation) => {
    setBusy(true);
    try {
      await deleteWorkspaceLocation(loc.id);
      onChange({
        ...business,
        locations: locations.filter((location) => location.id !== loc.id),
      });
      toast.success("Location deleted");
      if (editingId === loc.id) cancelEdit();
      setPendingDelete(null);
    } catch (error) {
      toast.error("Couldn't delete location", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padded>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-h3 text-ink" style={{ fontSize: 18 }}>
            Studios &amp; offices
          </h2>
          <p className="text-small mt-1">
            Save the places you regularly host sessions, then attach them to a
            session in one click.
          </p>
        </div>
        {!editingId && (
          <Button variant="secondary" size="sm" icon="plus" onClick={startNew}>
            Add location
          </Button>
        )}
      </div>

      {locations.length === 0 && !editingId && (
        <div className="rounded-md border border-dashed border-line bg-paper-2 px-4 py-5 text-small text-center">
          No saved locations yet. Add one to reuse it across sessions.
        </div>
      )}

      <div className="flex flex-col">
        {locations.map((loc) => {
          const editing = editingId === loc.id;
          if (editing && draft) {
            return (
              <LocationEditor
                key={loc.id}
                draft={draft}
                onChange={setDraft}
                onSave={save}
                onCancel={cancelEdit}
                busy={busy}
              />
            );
          }
          return (
            <div
              key={loc.id}
              className="flex items-center gap-3 py-3 border-b border-line-soft last:border-b-0"
            >
              <span className="w-9 h-9 rounded-md bg-paper-2 text-ink-2 flex items-center justify-center shrink-0">
                <Icon name="map-pin" size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium text-ink truncate">
                  {loc.label}
                </div>
                <div className="text-small truncate">
                  {formatAddressSummary(loc.address)}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon="edit"
                onClick={() => startEdit(loc)}
                disabled={!!editingId}
              />
              <Button
                variant="ghost"
                size="sm"
                icon="trash"
                onClick={() => setPendingDelete(loc)}
                disabled={!!editingId}
              />
            </div>
          );
        })}

        {editingId === "__new__" && draft && (
          <LocationEditor
            draft={draft}
            onChange={setDraft}
            onSave={save}
            onCancel={cancelEdit}
            busy={busy}
          />
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => !busy && setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) remove(pendingDelete);
        }}
        title={`Delete "${pendingDelete?.label ?? "this location"}"?`}
        description="Sessions that already use this location keep their address — only the saved entry is removed."
        confirmLabel="Delete location"
        destructive
        busy={busy}
      />
    </Card>
  );
}

export function LocationEditor({
  draft,
  onChange,
  onSave,
  onCancel,
  busy,
}: {
  draft: WorkspaceLocation;
  onChange: (next: WorkspaceLocation) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-md border border-line bg-surface-warm p-4 my-2 flex flex-col gap-4">
      <Field label="Location name" required>
        <Input
          value={draft.label}
          onChange={(e) => onChange({ ...draft, label: e.target.value })}
          placeholder="e.g. Mitte Studio"
        />
      </Field>
      <AddressForm
        value={draft.address}
        onChange={(address) => onChange({ ...draft, address })}
        disabled={busy}
      />
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={onSave} loading={busy}>
          Save location
        </Button>
      </div>
    </div>
  );
}
