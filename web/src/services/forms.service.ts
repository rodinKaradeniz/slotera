import formsJson from "@/data/mock/forms.json";
import responsesJson from "@/data/mock/form-responses.json";
import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { makeId } from "@/lib/id";
import type {
  FormResponse,
  FormResponseInput,
  FormTemplate,
  FormTemplateInput,
} from "@/types/form";
import { NotFoundError, NotImplementedError } from "./_errors";

type FormDto = components["schemas"]["FormTemplateResponse"];
type FormListDto = components["schemas"]["FormTemplateListResponse"];
type FormCreateDto = components["schemas"]["FormTemplateInput"];

let mock: FormTemplate[] = JSON.parse(JSON.stringify(formsJson)) as FormTemplate[];
let responses: FormResponse[] = JSON.parse(
  JSON.stringify(responsesJson),
) as FormResponse[];

function mapForm(form: FormDto): FormTemplate {
  return {
    id: form.id,
    name: form.name,
    description: form.description,
    status: form.status,
    fields: form.fields.map((field) => ({
      ...field,
      placeholder: field.placeholder ?? undefined,
      helpText: field.helpText ?? undefined,
      options: field.options ?? undefined,
    })),
    attachedServiceIds: form.attachedServiceIds,
    requiredBeforePayment: form.requiredBeforePayment,
    createdAtISO: form.createdAt,
  };
}

function createPayload(input: FormTemplateInput): FormCreateDto {
  return input;
}

export async function listForms(): Promise<FormTemplate[]> {
  if (dataSource === "api") {
    return (await apiRequest<FormListDto>("/forms")).items.map(mapForm);
  }
  await sleep(60);
  return [...mock];
}

export async function getForm(id: string): Promise<FormTemplate | null> {
  if (dataSource === "api") {
    try { return mapForm(await apiRequest<FormDto>(`/forms/${encodeURIComponent(id)}`)); }
    catch (error) { if (error instanceof Error && error.message.includes("not found")) return null; throw error; }
  }
  await sleep(40);
  return mock.find((f) => f.id === id) ?? null;
}

export async function createForm(
  input: FormTemplateInput,
): Promise<FormTemplate> {
  if (dataSource === "api") {
    return mapForm(await apiRequest<FormDto, FormCreateDto>("/forms", {
      method: "POST",
      body: createPayload(input),
      csrf: true,
    }));
  }
  await sleep(120);
  const created: FormTemplate = {
    ...input,
    id: makeId("frm"),
    createdAtISO: new Date().toISOString(),
  };
  mock = [created, ...mock];
  return created;
}

export async function updateForm(
  id: string,
  patch: Partial<FormTemplateInput>,
): Promise<FormTemplate> {
  if (dataSource === "api") {
    return mapForm(await apiRequest<FormDto, Partial<FormCreateDto>>(`/forms/${encodeURIComponent(id)}`, {
      method: "PATCH", body: patch, csrf: true,
    }));
  }
  await sleep(100);
  const idx = mock.findIndex((f) => f.id === id);
  if (idx === -1) throw new NotFoundError("form", id);
  const next: FormTemplate = { ...mock[idx], ...patch };
  mock = [...mock.slice(0, idx), next, ...mock.slice(idx + 1)];
  return next;
}

export async function deactivateForm(id: string): Promise<FormTemplate> {
  return updateForm(id, { status: "inactive" });
}

export async function activateForm(id: string): Promise<FormTemplate> {
  return updateForm(id, { status: "active" });
}

export async function removeForm(id: string): Promise<void> {
  if (dataSource === "api") {
    await apiRequest<void>(`/forms/${encodeURIComponent(id)}`, { method: "DELETE", csrf: true });
    return;
  }
  await sleep(80);
  mock = mock.filter((f) => f.id !== id);
}

/**
 * Active forms attached to a given service. This is the source of truth the
 * public booking flow uses to decide whether to show the conditional Forms
 * step — the relationship lives on `FormTemplate.attachedServiceIds`.
 */
export async function listFormsForService(
  serviceId: string,
): Promise<FormTemplate[]> {
  if (dataSource !== "mock")
    throw new NotImplementedError("listFormsForService");
  await sleep(50);
  return mock.filter(
    (f) => f.status === "active" && f.attachedServiceIds.includes(serviceId),
  );
}

/**
 * Add or remove a service from a form's attachment list. Used by the
 * "Attached forms" control in the service editor so attachment stays
 * single-sourced on the form template.
 */
export async function setFormServiceAttachment(
  formId: string,
  serviceId: string,
  attached: boolean,
): Promise<FormTemplate> {
  const form = mock.find((f) => f.id === formId);
  if (!form) throw new NotFoundError("form", formId);
  const has = form.attachedServiceIds.includes(serviceId);
  if (attached === has) return form;
  const attachedServiceIds = attached
    ? [...form.attachedServiceIds, serviceId]
    : form.attachedServiceIds.filter((id) => id !== serviceId);
  return updateForm(formId, { attachedServiceIds });
}

export async function saveFormResponse(
  input: FormResponseInput,
): Promise<FormResponse> {
  if (dataSource !== "mock") throw new NotImplementedError("saveFormResponse");
  await sleep(80);
  const created: FormResponse = {
    ...input,
    id: makeId("fr"),
    submittedAt: new Date().toISOString(),
  };
  responses = [created, ...responses];
  return created;
}
