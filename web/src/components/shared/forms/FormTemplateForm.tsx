"use client";
import { translateInterfaceLabel } from "@/lib/i18n";
import { useI18n } from "@/components/i18n/I18nProvider";

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
import type {
  FormField,
  FormFieldType,
  FormTemplateInput,
} from "@/types/form";
import type { Service } from "@/types/service";

/**
 * Controlled editor for a form template. The caller owns state, save plumbing,
 * and footer actions (mirrors `ServiceForm`). This renders fields only.
 *
 * Kept deliberately simple: add/remove/reorder fields, pick from the 7 MVP
 * field types, attach to services. No conditional logic, branching, file
 * uploads, signatures, analytics, or complex validation.
 */
export type FormTemplateFormValue = FormTemplateInput;

type Props = {
  value: FormTemplateFormValue;
  onChange: (next: FormTemplateFormValue) => void;
  disabled?: boolean;
};

const FIELD_TYPE_OPTIONS: { value: FormFieldType; label: string }[] = [
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "single_select", label: "Single choice" },
  { value: "multi_select", label: "Multiple choice" },
  { value: "date", label: "Date" },
  { value: "yes_no", label: "Yes / No" },
  { value: "consent_checkbox", label: "Consent checkbox" },
];

function hasOptions(type: FormFieldType): boolean {
  return type === "single_select" || type === "multi_select";
}

export function FormTemplateForm({ value, onChange, disabled }: Props) {
  const { t: uiText, lang: labelLang } = useI18n();
  const [services, setServices] = React.useState<Service[]>([]);

  // Refs to each field's label input, keyed by field id, so a freshly added
  // field can be scrolled into view + focused once it has rendered.
  const labelRefs = React.useRef<Map<string, HTMLInputElement>>(new Map());
  const pendingFocusId = React.useRef<string | null>(null);

  React.useEffect(() => {
    listServices().then((s) => setServices(s.filter((x) => x.active)));
  }, []);

  React.useEffect(() => {
    const id = pendingFocusId.current;
    if (!id) return;
    const el = labelRefs.current.get(id);
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
  }, [value.fields]);

  const patch = (p: Partial<FormTemplateFormValue>) => onChange({ ...value, ...p });

  const updateField = (id: string, fieldPatch: Partial<FormField>) =>
    patch({
      fields: value.fields.map((f) =>
        f.id === id ? { ...f, ...fieldPatch } : f,
      ),
    });

  const addField = () => {
    const id = makeId("ff");
    pendingFocusId.current = id;
    patch({
      fields: [
        ...value.fields,
        {
          id,
          label: "",
          type: "short_text",
          required: false,
        },
      ],
    });
  };

  const removeField = (id: string) =>
    patch({ fields: value.fields.filter((f) => f.id !== id) });

  const moveField = (idx: number, dir: -1 | 1) => {
    const next = [...value.fields];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    patch({ fields: next });
  };

  const toggleService = (serviceId: string) => {
    const has = value.attachedServiceIds.includes(serviceId);
    patch({
      attachedServiceIds: has
        ? value.attachedServiceIds.filter((id) => id !== serviceId)
        : [...value.attachedServiceIds, serviceId],
    });
  };

  return (
    <fieldset
      disabled={disabled}
      className="flex flex-col gap-5 disabled:opacity-90"
    >
      <Field label={uiText("ui.form.name")} required>
        <Input
          value={value.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder={uiText("ui.e.g.discovery.call.prep")}
        />
      </Field>

      <Field
        label={uiText("ui.description")}
        hint={uiText("ui.one.short.line.clients.see.at.the.top.of.the.form")}
      >
        <Textarea
          value={value.description}
          rows={2}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </Field>

      {/* Fields editor */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-ink">{uiText("ui.fields")}</span>
          <Button variant="secondary" size="sm" icon="plus" onClick={addField}>
            {uiText("ui.add.field")}</Button>
        </div>

        {value.fields.length === 0 ? (
          <p className="text-small text-ink-3 rounded-md border border-dashed border-line px-4 py-6 text-center">
            {uiText("ui.no.fields.yet.add.a.question.or.an.acknowledgement.to.get.started")}</p>
        ) : (
          value.fields.map((f, idx) => (
            <div
              key={f.id}
              className="rounded-md border border-line bg-surface-warm p-4 flex flex-col gap-3"
            >
              <div className="flex items-center gap-2">
                <Pill tone="neutral">{`#${idx + 1}`}</Pill>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => moveField(idx, -1)}
                  disabled={idx === 0}
                  className="text-ink-3 hover:text-ink disabled:opacity-30"
                  aria-label={uiText("ui.move.field.up")}
                >
                  <Icon name="chevron-u" size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => moveField(idx, 1)}
                  disabled={idx === value.fields.length - 1}
                  className="text-ink-3 hover:text-ink disabled:opacity-30"
                  aria-label={uiText("ui.move.field.down")}
                >
                  <Icon name="chevron-d" size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => removeField(f.id)}
                  className="text-ink-3 hover:text-danger"
                  aria-label={uiText("ui.remove.field")}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>

              <Field label={uiText("ui.label")} required>
                <Input
                  ref={(el) => {
                    const m = labelRefs.current;
                    if (el) m.set(f.id, el);
                    else m.delete(f.id);
                  }}
                  value={f.label}
                  onChange={(e) => updateField(f.id, { label: e.target.value })}
                  placeholder={uiText("ui.e.g.what.would.you.like.us.to.look.at")}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={uiText("ui.type")}>
                  <Select
                    value={f.type}
                    onChange={(e) => {
                      const type = e.target.value as FormFieldType;
                      updateField(f.id, {
                        type,
                        options: hasOptions(type) ? f.options ?? ["", ""] : undefined,
                      });
                    }}
                    options={FIELD_TYPE_OPTIONS.map((option) => ({ ...option, label: translateInterfaceLabel(labelLang, option.label) }))}
                  />
                </Field>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <Toggle
                      size="sm"
                      checked={f.required}
                      onChange={(v) => updateField(f.id, { required: v })}
                    />
                    <span className="text-[13px] text-ink">{uiText("ui.required")}</span>
                  </label>
                </div>
              </div>

              {hasOptions(f.type) && (
                <ChoiceOptions
                  options={f.options?.length ? f.options : ["", ""]}
                  onChange={(options) => updateField(f.id, { options })}
                />
              )}

              {f.type !== "consent_checkbox" &&
                f.type !== "yes_no" &&
                f.type !== "date" && (
                  <Field label={uiText("ui.placeholder")} optional>
                    <Input
                      value={f.placeholder ?? ""}
                      onChange={(e) =>
                        updateField(f.id, { placeholder: e.target.value })
                      }
                    />
                  </Field>
                )}

              <Field label={uiText("ui.help.text")} optional>
                <Input
                  value={f.helpText ?? ""}
                  onChange={(e) =>
                    updateField(f.id, { helpText: e.target.value })
                  }
                  placeholder={uiText("ui.shown.beneath.the.field")}
                />
              </Field>
            </div>
          ))
        )}
      </div>

      {/* Attach to services */}
      <Field
        group
        label={uiText("ui.attached.services")}
        hint={uiText("ui.clients.booking.these.services.will.complete.this.form.before.payment")}
      >
        {services.length === 0 ? (
          <p className="text-small text-ink-3">{uiText("ui.no.active.services.yet")}</p>
        ) : (
          <div className="flex flex-col gap-1.5 rounded-md border border-line p-2">
            {services.map((s) => {
              const checked = value.attachedServiceIds.includes(s.id);
              return (
                <label
                  key={s.id}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-surface-warm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleService(s.id)}
                    className="accent-accent w-4 h-4"
                  />
                  <span className="text-[14px] text-ink">{s.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </Field>

      <div className="flex items-center justify-between rounded-md border border-line bg-surface-warm p-4">
        <div>
          <div className="text-[14px] font-medium text-ink">
            {uiText("ui.required.before.payment")}</div>
          <div className="text-small">
            {uiText("ui.clients.must.complete.this.form.before.they.can.pay")}</div>
        </div>
        <Toggle
          checked={value.requiredBeforePayment}
          onChange={(v) => patch({ requiredBeforePayment: v })}
        />
      </div>

      <div className="flex items-center justify-between rounded-md border border-line bg-surface-warm p-4">
        <div>
          <div className="text-[14px] font-medium text-ink">
            {value.status === "active" ? uiText("ui.active") : uiText("ui.inactive")}
          </div>
          <div className="text-small">
            {uiText("ui.inactive.forms.don.t.appear.in.the.booking.flow")}</div>
        </div>
        <Toggle
          checked={value.status === "active"}
          onChange={(v) => patch({ status: v ? "active" : "inactive" })}
        />
      </div>
    </fieldset>
  );
}


function ChoiceOptions({ options, onChange }: { options: string[]; onChange: (options: string[]) => void }) {
  const { t } = useI18n();
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const pendingFocus = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (pendingFocus.current === null) return;
    refs.current[pendingFocus.current]?.focus();
    pendingFocus.current = null;
  }, [options]);
  const add = () => {
    if (options.length >= 100) return;
    pendingFocus.current = options.length;
    onChange([...options, ""]);
  };
  return <Field group label={t("ui.options")}>
    <div className="flex flex-col gap-2">
      {options.map((option, index) => <div key={index} className="flex items-center gap-2">
        <Input
          ref={(node) => { refs.current[index] = node; }}
          className="flex-1"
          aria-label={t("forms.option.number", { number: index + 1 })}
          value={option}
          onChange={(event) => onChange(options.map((value, i) => i === index ? event.target.value : value))}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (index + 1 < options.length) refs.current[index + 1]?.focus();
            else add();
          }}
        />
        <Button variant="ghost" size="sm" icon="trash" aria-label={t("forms.remove.option", { number: index + 1 })}
          disabled={options.length <= 1} onClick={() => onChange(options.filter((_, i) => i !== index))} />
        {index === options.length - 1 && <Button variant="secondary" size="sm" icon="plus"
          aria-label={t("forms.add.option")} disabled={options.length >= 100} onClick={add} />}
      </div>)}
    </div>
  </Field>;
}
