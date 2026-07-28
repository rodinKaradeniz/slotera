"use client";

import * as React from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { makeId } from "@/lib/id";
import { listServices } from "@/services/services.service";
import type { Currency } from "@/types/common";
import type { PackageItem, ServicePackageInput } from "@/types/package";
import type { Service } from "@/types/service";

/**
 * Controlled editor for a package. The caller owns state, save plumbing, and
 * footer actions (mirrors `ServiceForm` / `FormTemplateForm`). Renders fields
 * only.
 *
 * A package is an ordered bundle of existing services. The item editor manages
 * `value.items` as an array; `order` is recomputed from array position on every
 * change so the stored order always matches what the operator sees. Deliberately
 * simple: no checkout, credit ledger, recurring billing, or entitlement rules.
 */
export type PackageFormValue = ServicePackageInput;

type Props = {
  value: PackageFormValue;
  onChange: (next: PackageFormValue) => void;
  disabled?: boolean;
};

/** Re-number items from their array position so `order` stays consistent. */
function reindex(items: PackageItem[]): PackageItem[] {
  return items.map((item, i) => ({ ...item, order: i }));
}

export function PackageForm({ value, onChange, disabled }: Props) {
  const [services, setServices] = React.useState<Service[]>([]);

  // Focus the most-recently-added item's service select once it renders.
  const itemRefs = React.useRef<Map<string, HTMLSelectElement>>(new Map());
  const pendingFocusId = React.useRef<string | null>(null);

  React.useEffect(() => {
    listServices().then((s) => setServices(s.filter((x) => x.active)));
  }, []);

  React.useEffect(() => {
    const id = pendingFocusId.current;
    if (!id) return;
    const el = itemRefs.current.get(id);
    if (!el) return;
    pendingFocusId.current = null;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
      el.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "center",
      });
      el.focus();
    });
  }, [value.items]);

  const patch = (p: Partial<PackageFormValue>) => onChange({ ...value, ...p });

  const setItems = (items: PackageItem[]) => patch({ items: reindex(items) });

  const updateItem = (id: string, itemPatch: Partial<PackageItem>) =>
    setItems(value.items.map((it) => (it.id === id ? { ...it, ...itemPatch } : it)));

  const addItem = () => {
    const id = makeId("pi");
    pendingFocusId.current = id;
    const firstService = services[0]?.id ?? "";
    setItems([
      ...value.items,
      { id, serviceId: firstService, order: value.items.length },
    ]);
  };

  const removeItem = (id: string) =>
    setItems(value.items.filter((it) => it.id !== id));

  const moveItem = (idx: number, dir: -1 | 1) => {
    const next = [...value.items];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setItems(next);
  };

  const serviceOptions = services.map((s) => ({ value: s.id, label: s.name }));

  return (
    <fieldset
      disabled={disabled}
      className="flex flex-col gap-5 disabled:opacity-90"
    >
      <Field label="Name" required>
        <Input
          value={value.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="e.g. 4-Session Coaching Package"
        />
      </Field>

      <Field
        label="Description"
        hint="One short line describing what the package includes."
      >
        <Textarea
          value={value.description}
          rows={2}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Price">
          <Input
            type="number"
            prefix={value.currency}
            value={String(value.priceCents / 100)}
            onChange={(e) =>
              patch({
                priceCents: Math.max(
                  0,
                  Math.round(Number(e.target.value) * 100) || 0,
                ),
              })
            }
            min={0}
          />
        </Field>
        <Field label="Currency">
          <Select
            value={value.currency}
            onChange={(e) => patch({ currency: e.target.value as Currency })}
            options={["EUR", "USD", "GBP"]}
          />
        </Field>
      </div>

      {/* Ordered package items — single-sourced on items[].serviceId. */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[13px] font-medium text-ink">
              Included sessions
            </span>
            <p className="text-small">
              Add services in the order clients work through them.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon="plus"
            onClick={addItem}
            disabled={services.length === 0}
          >
            Add item
          </Button>
        </div>

        {services.length === 0 ? (
          <p className="text-small text-ink-3 rounded-md border border-dashed border-line px-4 py-6 text-center">
            No active services yet. Create a service first, then build a package
            from it.
          </p>
        ) : value.items.length === 0 ? (
          <p className="text-small text-ink-3 rounded-md border border-dashed border-line px-4 py-6 text-center">
            No sessions yet. Add the services this package bundles together.
          </p>
        ) : (
          value.items.map((item, idx) => (
            <div
              key={item.id}
              className="rounded-md border border-line bg-surface-warm p-4 flex flex-col gap-3"
            >
              <div className="flex items-center gap-2">
                <Pill tone="neutral">{`#${idx + 1}`}</Pill>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => moveItem(idx, -1)}
                  disabled={idx === 0}
                  className="text-ink-3 hover:text-ink disabled:opacity-30"
                  aria-label="Move item up"
                >
                  <Icon name="chevron-u" size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(idx, 1)}
                  disabled={idx === value.items.length - 1}
                  className="text-ink-3 hover:text-ink disabled:opacity-30"
                  aria-label="Move item down"
                >
                  <Icon name="chevron-d" size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-ink-3 hover:text-danger"
                  aria-label="Remove item"
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>

              <Field label="Service" required>
                <Select
                  ref={(el) => {
                    const m = itemRefs.current;
                    if (el) m.set(item.id, el);
                    else m.delete(item.id);
                  }}
                  value={item.serviceId}
                  onChange={(e) =>
                    updateItem(item.id, { serviceId: e.target.value })
                  }
                  options={serviceOptions}
                />
              </Field>

              <Field
                label="Item title"
                optional
                hint="Shown instead of the service name, e.g. “Kick-off call”."
              >
                <Input
                  value={item.title ?? ""}
                  onChange={(e) =>
                    updateItem(item.id, { title: e.target.value || undefined })
                  }
                  placeholder="Optional"
                />
              </Field>

              <Field label="Item note" optional>
                <Input
                  value={item.description ?? ""}
                  onChange={(e) =>
                    updateItem(item.id, {
                      description: e.target.value || undefined,
                    })
                  }
                  placeholder="Optional one-line note for this step."
                />
              </Field>
            </div>
          ))
        )}
      </div>

      <Field
        label="Internal notes"
        optional
        hint="Only visible to you. Use for delivery notes or context."
      >
        <Textarea
          value={value.notes ?? ""}
          rows={2}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="e.g. Space sessions 2–3 weeks apart."
        />
      </Field>

      <div className="flex items-center justify-between rounded-md border border-line bg-surface-warm p-4">
        <div>
          <div className="text-[14px] font-medium text-ink">Featured</div>
          <div className="text-small">
            Highlight this package in the catalog and the booking hint.
          </div>
        </div>
        <Toggle
          checked={!!value.featured}
          onChange={(v) => patch({ featured: v })}
        />
      </div>

      <div className="flex items-center justify-between rounded-md border border-line bg-surface-warm p-4">
        <div>
          <div className="text-[14px] font-medium text-ink">
            {value.status === "active" ? "Active" : "Inactive"}
          </div>
          <div className="text-small">
            Inactive packages are hidden from the booking hint.
          </div>
        </div>
        <Toggle
          checked={value.status === "active"}
          onChange={(v) => patch({ status: v ? "active" : "inactive" })}
        />
      </div>
    </fieldset>
  );
}
