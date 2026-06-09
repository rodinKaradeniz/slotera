"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { FormFieldInput } from "./FormFieldInput";
import { FORM_PURPOSE } from "@/lib/status-maps";
import type { FormAnswer, FormTemplate } from "@/types/form";

type Props = {
  forms: FormTemplate[];
  responses: Record<string, FormAnswer[]>;
  onChange: (responses: Record<string, FormAnswer[]>) => void;
};

export function StepForms({ forms, responses, onChange }: Props) {
  const getValue = (formId: string, fieldId: string) =>
    (responses[formId] ?? []).find((a) => a.fieldId === fieldId)?.value;

  const setValue = (
    formId: string,
    fieldId: string,
    value: string | string[] | boolean,
  ) => {
    const current = responses[formId] ?? [];
    const without = current.filter((a) => a.fieldId !== fieldId);
    onChange({ ...responses, [formId]: [...without, { fieldId, value }] });
  };

  return (
    <div className="flex flex-col gap-5">
      {forms.map((form) => (
        <Card key={form.id} padded>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3
                className="font-serif text-ink"
                style={{ fontSize: 20, fontWeight: 400 }}
              >
                {form.name}
              </h3>
              {form.description && (
                <p className="text-small mt-1">{form.description}</p>
              )}
            </div>
            <Pill tone="neutral">{FORM_PURPOSE[form.purpose]}</Pill>
          </div>

          <div className="flex flex-col gap-4 mt-5">
            {form.fields.map((field) => (
              <FormFieldInput
                key={field.id}
                field={field}
                value={getValue(form.id, field.id)}
                onChange={(v) => setValue(form.id, field.id, v)}
              />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

/**
 * Whether every required field across the given forms has a non-empty answer.
 * Shared by the booking page's `canAdvance` gate.
 */
export function areRequiredFormsComplete(
  forms: FormTemplate[],
  responses: Record<string, FormAnswer[]>,
): boolean {
  return forms.every((form) =>
    form.fields.every((field) => {
      if (!field.required) return true;
      const answer = (responses[form.id] ?? []).find(
        (a) => a.fieldId === field.id,
      )?.value;
      if (answer === undefined || answer === null) return false;
      if (typeof answer === "string") return answer.trim().length > 0;
      if (Array.isArray(answer)) return answer.length > 0;
      if (typeof answer === "boolean") return answer === true;
      return true;
    }),
  );
}
