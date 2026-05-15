"use client";

import * as React from "react";
import { DrawerShell } from "@/components/ui/DrawerShell";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import {
  createService,
  updateService,
  deactivateService,
  activateService,
  removeService,
} from "@/services/services.service";
import type { Service } from "@/types/service";
import type { ServiceKind, LocationType, Currency } from "@/types/common";

export type ServiceDrawerProps = {
  open: boolean;
  onClose: () => void;
  initial?: Service | null;
  onSaved?: (s: Service) => void;
  onRemoved?: (id: string) => void;
};

const DEFAULTS: Omit<Service, "id" | "createdAtISO"> = {
  name: "",
  description: "",
  kind: "discovery",
  durationMin: 60,
  priceCents: 12000,
  currency: "EUR",
  capacity: 1,
  locationType: "online",
  location: "Zoom · link sent on confirmation",
  cancellationRule: "Free reschedule up to 12h before.",
  active: true,
};

export function ServiceDrawer({
  open,
  onClose,
  initial,
  onSaved,
  onRemoved,
}: ServiceDrawerProps) {
  const isEdit = !!initial;
  const [form, setForm] = React.useState<Omit<Service, "id" | "createdAtISO">>(
    initial
      ? { ...initial }
      : DEFAULTS,
  );
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) setForm(initial ? { ...initial } : DEFAULTS);
  }, [initial, open]);

  const save = async () => {
    setBusy(true);
    try {
      if (isEdit && initial) {
        const next = await updateService(initial.id, form);
        onSaved?.(next);
      } else {
        const next = await createService(form);
        onSaved?.(next);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    if (!initial) return;
    setBusy(true);
    try {
      const next = initial.active
        ? await deactivateService(initial.id)
        : await activateService(initial.id);
      onSaved?.(next);
      setForm((f) => ({ ...f, active: next.active }));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!initial) return;
    if (!confirm(`Permanently delete "${initial.name}"? This cannot be undone.`))
      return;
    setBusy(true);
    try {
      await removeService(initial.id);
      onRemoved?.(initial.id);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      eyebrow={isEdit ? "Edit service" : "New service"}
      title={isEdit ? form.name || "Untitled service" : "Create a service"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Service name" required>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Strategy Deep Dive"
          />
        </Field>

        <Field label="Description" hint="One short line clients see on the booking page.">
          <Textarea
            value={form.description}
            rows={3}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Type">
            <Select
              value={form.kind}
              onChange={(e) =>
                setForm({ ...form, kind: e.target.value as ServiceKind })
              }
              options={[
                { value: "discovery", label: "Discovery" },
                { value: "deepdive", label: "Deep Dive" },
                { value: "sprint", label: "Sprint" },
                { value: "yoga", label: "Yoga" },
                { value: "workshop", label: "Workshop" },
              ]}
            />
          </Field>
          <Field label="Duration (min)">
            <Input
              type="number"
              value={String(form.durationMin)}
              onChange={(e) =>
                setForm({ ...form, durationMin: Number(e.target.value) || 0 })
              }
              min={5}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Price">
            <Input
              type="number"
              prefix={form.currency}
              value={String(form.priceCents / 100)}
              onChange={(e) =>
                setForm({
                  ...form,
                  priceCents: Math.round(Number(e.target.value) * 100) || 0,
                })
              }
              min={0}
            />
          </Field>
          <Field label="Currency">
            <Select
              value={form.currency}
              onChange={(e) =>
                setForm({ ...form, currency: e.target.value as Currency })
              }
              options={["EUR", "USD", "GBP"]}
            />
          </Field>
        </div>

        <Field label="Capacity" hint="1 for 1:1. Higher for group sessions or workshops.">
          <Input
            type="number"
            value={String(form.capacity)}
            onChange={(e) =>
              setForm({ ...form, capacity: Math.max(1, Number(e.target.value) || 1) })
            }
            min={1}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Location type">
            <Select
              value={form.locationType}
              onChange={(e) =>
                setForm({
                  ...form,
                  locationType: e.target.value as LocationType,
                })
              }
              options={[
                { value: "online", label: "Online" },
                { value: "physical", label: "In person" },
                { value: "hybrid", label: "Hybrid" },
              ]}
            />
          </Field>
          <Field label="Meeting / location">
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Cancellation / reschedule rule">
          <Textarea
            value={form.cancellationRule}
            rows={2}
            onChange={(e) =>
              setForm({ ...form, cancellationRule: e.target.value })
            }
          />
        </Field>

        <div className="flex items-center justify-between rounded-md border border-line bg-surface-warm p-4">
          <div>
            <div className="text-[14px] font-medium text-ink">
              {form.active ? "Active" : "Inactive"}
            </div>
            <div className="text-small">
              Inactive services don&apos;t appear on the booking page.
            </div>
          </div>
          <Toggle
            checked={form.active}
            onChange={(v) => setForm({ ...form, active: v })}
          />
        </div>

        {isEdit && (
          <div className="mt-4 pt-5 border-t border-line-soft">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="alert" size={14} className="text-danger" />
              <span className="font-medium text-ink">Danger zone</span>
            </div>
            <p className="text-small mb-3">
              Deactivating hides the service; removing deletes it permanently.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={toggleActive}
                disabled={busy}
              >
                {form.active ? "Deactivate" : "Activate"}
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon="trash"
                onClick={remove}
                disabled={busy}
              >
                Remove service
              </Button>
            </div>
          </div>
        )}
      </div>
    </DrawerShell>
  );
}
