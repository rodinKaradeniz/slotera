"use client";

import * as React from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { SegGroup } from "@/components/ui/SegGroup";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { FormField } from "@/types/form";

/**
 * Renders a single form field by type, mapping the 7 MVP field types onto the
 * shared UI primitives. Controlled — the caller owns the answer value.
 */
type Props = {
  field: FormField;
  value: string | string[] | boolean | undefined;
  onChange: (value: string | string[] | boolean) => void;
};

export function FormFieldInput({ field, value, onChange }: Props) {
  const { t } = useI18n();
  const { type, label, required, placeholder, helpText } = field;

  // Consent + yes/no render their own label, so don't double up via <Field>.
  if (type === "consent_checkbox") {
    return (
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          className="accent-accent w-4 h-4 mt-0.5 shrink-0"
        />
        <span className="text-[14px] text-ink">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </span>
      </label>
    );
  }

  if (type === "yes_no") {
    return (
      <Field label={label} required={required} hint={helpText}>
        <div>
          <SegGroup
            value={value === true ? "yes" : value === false ? "no" : ""}
            onChange={(v) => onChange(v === "yes")}
            options={[
              { value: "yes", label: t("booking.field.yes") },
              { value: "no", label: t("booking.field.no") },
            ]}
          />
        </div>
      </Field>
    );
  }

  return (
    <Field
      label={label}
      required={required}
      hint={helpText}
      optional={!required}
    >
      {type === "short_text" && (
        <Input
          value={typeof value === "string" ? value : ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {type === "long_text" && (
        <Textarea
          value={typeof value === "string" ? value : ""}
          rows={3}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {type === "date" && (
        <Input
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {type === "single_select" && (
        <Select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          options={[
            { value: "", label: t("booking.field.select") },
            ...(field.options ?? []).map((o) => ({ value: o, label: o })),
          ]}
        />
      )}

      {type === "multi_select" && (
        <div className="flex flex-col gap-1.5 rounded-md border border-line p-2">
          {(field.options ?? []).map((o) => {
            const arr = Array.isArray(value) ? value : [];
            const checked = arr.includes(o);
            return (
              <label
                key={o}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-surface-warm cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange(
                      checked ? arr.filter((x) => x !== o) : [...arr, o],
                    )
                  }
                  className="accent-accent w-4 h-4"
                />
                <span className="text-[14px] text-ink">{o}</span>
              </label>
            );
          })}
        </div>
      )}
    </Field>
  );
}
