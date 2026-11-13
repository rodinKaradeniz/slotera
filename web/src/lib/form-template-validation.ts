import type { MessageKey } from "@/i18n/messages/en";
import type { FormTemplateInput } from "@/types/form";

export type FormTemplateErrors = {
  name?: MessageKey;
  fields: Record<string, { label?: MessageKey; options?: MessageKey }>;
};

export function validateFormTemplate(value: FormTemplateInput): FormTemplateErrors {
  const errors: FormTemplateErrors = { fields: {} };
  if (!value.name.trim()) errors.name = "forms.name.required";
  for (const field of value.fields) {
    const error: FormTemplateErrors["fields"][string] = {};
    if (!field.label.trim()) error.label = "forms.label.required";
    if ((field.type === "single_select" || field.type === "multi_select") &&
      !field.options?.some((option) => option.trim())) error.options = "forms.options.required";
    if (error.label || error.options) errors.fields[field.id] = error;
  }
  return errors;
}
