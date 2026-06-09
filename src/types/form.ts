/**
 * Forms are reusable templates an operator builds once and attaches to one or
 * more services. When a client books a service that has active forms attached,
 * the public booking flow surfaces a conditional Forms step before payment so
 * the client can provide intake questions / agreement acknowledgement.
 *
 * Terminology (see CLAUDE.md):
 * - FormTemplate — the reusable form the operator creates.
 * - FormField    — an adjustable field inside a form.
 * - FormResponse — answers a client submits for a booking.
 *
 * This is deliberately a lightweight model: no conditional logic, file uploads,
 * signatures, branching, analytics, or complex validation.
 */

export type FormPurpose = "intake" | "questions" | "agreement" | "nda" | "other";

export type FormFieldType =
  | "short_text"
  | "long_text"
  | "single_select"
  | "multi_select"
  | "date"
  | "yes_no"
  | "consent_checkbox";

export type FormField = {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  /** Only meaningful for single_select / multi_select. */
  options?: string[];
};

export type FormStatus = "active" | "inactive";

export type FormTemplate = {
  id: string;
  name: string;
  description: string;
  status: FormStatus;
  purpose: FormPurpose;
  fields: FormField[];
  /** Services this form is attached to. Source of truth for the public flow. */
  attachedServiceIds: string[];
  requiredBeforePayment: boolean;
  createdAtISO: string;
};

export type FormTemplateInput = Omit<FormTemplate, "id" | "createdAtISO">;

export type FormAnswer = {
  fieldId: string;
  value: string | string[] | boolean;
};

export type FormResponse = {
  id: string;
  bookingId: string;
  formTemplateId: string;
  answers: FormAnswer[];
  submittedAt: string;
};

export type FormResponseInput = Omit<FormResponse, "id" | "submittedAt">;
