"use client";
import { currencySymbol } from "@/lib/money";
import { useI18n } from "@/components/i18n/I18nProvider";

import { dataSource } from "@/lib/env";
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
import { useServiceOptions } from "@/lib/use-service-options";
import { LoadError } from "@/components/shared/LoadError";
import type { Currency } from "@/types/common";
import type { PackageItem, ServicePackageInput } from "@/types/package";

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
  const { t: uiText } = useI18n();
  const options = useServiceOptions(value.items.map((item) => item.serviceId).filter(Boolean));
  const services = options.data ?? [];

  // Focus the most-recently-added item's service select once it renders.
  const itemRefs = React.useRef<Map<string, HTMLSelectElement>>(new Map());
  const pendingFocusId = React.useRef<string | null>(null);


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
      <Input value={options.search} placeholder={uiText("common.search")} onChange={(event) => options.setSearch(event.target.value)} />
        {options.error && <LoadError message={options.error} onRetry={options.reload} />}
        <Field label={uiText("ui.name")} required>
        <Input
          value={value.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder={uiText("ui.e.g.4.session.coaching.package")}
        />
      </Field>

      <Field
        label={uiText("ui.description")}
        hint={uiText("ui.one.short.line.describing.what.the.package.includes")}
      >
        <Textarea
          value={value.description}
          rows={2}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={uiText("ui.price")}>
          <Input
            type="number"
            prefix={currencySymbol(value.currency)}
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
        <Field label={uiText("ui.currency")}>
          <Select
            value={value.currency}
            disabled={dataSource === "api"}
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
              {uiText("ui.included.sessions")}</span>
            <p className="text-small">
              {uiText("ui.add.services.in.the.order.clients.work.through.them")}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon="plus"
            onClick={addItem}
            disabled={services.length === 0}
          >
            {uiText("ui.add.item")}</Button>
        </div>

        {services.length === 0 ? (
          <p className="text-small text-ink-3 rounded-md border border-dashed border-line px-4 py-6 text-center">
            {uiText("ui.no.active.services.yet.create.a.service.first.then.build.a.package.from.it")}</p>
        ) : value.items.length === 0 ? (
          <p className="text-small text-ink-3 rounded-md border border-dashed border-line px-4 py-6 text-center">
            {uiText("ui.no.sessions.yet.add.the.services.this.package.bundles.together")}</p>
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
                  aria-label={uiText("ui.move.item.up")}
                >
                  <Icon name="chevron-u" size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(idx, 1)}
                  disabled={idx === value.items.length - 1}
                  className="text-ink-3 hover:text-ink disabled:opacity-30"
                  aria-label={uiText("ui.move.item.down")}
                >
                  <Icon name="chevron-d" size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-ink-3 hover:text-danger"
                  aria-label={uiText("ui.remove.item")}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>

              <Field label={uiText("ui.service")} required>
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
                label={uiText("ui.item.title")}
                optional
                hint={uiText("ui.shown.instead.of.the.service.name.e.g.kick.off.call")}
              >
                <Input
                  value={item.title ?? ""}
                  onChange={(e) =>
                    updateItem(item.id, { title: e.target.value || undefined })
                  }
                  placeholder={uiText("ui.optional")}
                />
              </Field>

              <Field label={uiText("ui.item.note")} optional>
                <Input
                  value={item.description ?? ""}
                  onChange={(e) =>
                    updateItem(item.id, {
                      description: e.target.value || undefined,
                    })
                  }
                  placeholder={uiText("ui.optional.one.line.note.for.this.step")}
                />
              </Field>
            </div>
          ))
        )}
      </div>

      <Field
        label={uiText("ui.internal.notes")}
        optional
        hint={uiText("ui.only.visible.to.you.use.for.delivery.notes.or.context")}
      >
        <Textarea
          value={value.notes ?? ""}
          rows={2}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder={uiText("ui.e.g.space.sessions.2.3.weeks.apart")}
        />
      </Field>

      <div className="flex items-center justify-between rounded-md border border-line bg-surface-warm p-4">
        <div>
          <div className="text-[14px] font-medium text-ink">{uiText("ui.featured")}</div>
          <div className="text-small">
            {uiText("ui.highlight.this.package.in.the.catalog.and.the.booking.hint")}</div>
        </div>
        <Toggle
          checked={!!value.featured}
          onChange={(v) => patch({ featured: v })}
        />
      </div>

      <div className="flex items-center justify-between rounded-md border border-line bg-surface-warm p-4">
        <div>
          <div className="text-[14px] font-medium text-ink">
            {value.status === "active" ? uiText("ui.active") : uiText("ui.inactive")}
          </div>
          <div className="text-small">
            {uiText("ui.inactive.packages.are.hidden.from.the.booking.hint")}</div>
        </div>
        <Toggle
          checked={value.status === "active"}
          onChange={(v) => patch({ status: v ? "active" : "inactive" })}
        />
      </div>
    </fieldset>
  );
}
