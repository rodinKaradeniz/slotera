import { mockData } from "@/services/adapters/mock-data";
import { nextEditVersion } from "./_editing";


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
import { listPublicServiceForms } from "./public-booking.service";

type FormDto = components["schemas"]["FormTemplateResponse"];
type FormListDto = components["schemas"]["FormTemplateListResponse"];
type FormCreateDto = components["schemas"]["FormTemplateInput"];

let mock: FormTemplate[] = dataSource === "mock" ? mockData("forms") : [] as FormTemplate[];
mock = mock.map((item) => ({...item, version: item.version ?? 1}));
let responses: FormResponse[] = dataSource === "mock" ? mockData("form-responses") : [] as FormResponse[];

function mapForm(form: FormDto): FormTemplate {
  return {
    version: form.version,
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

function formPayload(input: Partial<FormTemplateInput>): Partial<FormTemplateInput> {
  return {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.requiredBeforePayment !== undefined && { requiredBeforePayment: input.requiredBeforePayment }),
    ...(input.attachedServiceIds !== undefined && { attachedServiceIds: [...input.attachedServiceIds] }),
    ...(input.fields !== undefined && { fields: input.fields.map((field) => ({
      id: field.id, label: field.label, type: field.type, required: field.required,
      placeholder: field.placeholder, helpText: field.helpText,
      ...((field.type === "single_select" || field.type === "multi_select") && {
        options: (field.options ?? []).map((option) => option.trim()).filter(Boolean),
      }),
    })) }),
  };
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
      body: formPayload(input) as FormCreateDto,
      csrf: true,
    }));
  }
  await sleep(120);
  const created: FormTemplate = {
    version: 1,
    ...formPayload(input) as FormTemplateInput,
    id: makeId("frm"),
    createdAtISO: new Date().toISOString(),
  };
  mock = [created, ...mock];
  return created;
}

export async function updateForm(
  id: string,
  patch: Partial<FormTemplateInput>,
  expectedVersion?: number,
): Promise<FormTemplate> {
  if (dataSource === "api") {
    return mapForm(await apiRequest<FormDto, Partial<FormCreateDto>>(`/forms/${encodeURIComponent(id)}`, {
      method: "PATCH", expectedVersion, body: formPayload(patch), csrf: true,
    }));
  }
  await sleep(100);
  const idx = mock.findIndex((f) => f.id === id);
  if (idx === -1) throw new NotFoundError("form", id);
  const next: FormTemplate = { ...mock[idx], ...formPayload(patch), version: nextEditVersion(mock[idx], expectedVersion) };
  mock = [...mock.slice(0, idx), next, ...mock.slice(idx + 1)];
  return next;
}

export async function deactivateForm(id: string, expectedVersion?: number): Promise<FormTemplate> {
  return updateForm(id, { status: "inactive" }, expectedVersion);
}

export async function activateForm(id: string, expectedVersion?: number): Promise<FormTemplate> {
  return updateForm(id, { status: "active" }, expectedVersion);
}

export async function removeForm(id: string,
  expectedVersion?: number,
): Promise<void> {
  if (dataSource === "api") {
    await apiRequest<void>(`/forms/${encodeURIComponent(id)}`, { method: "DELETE", expectedVersion, csrf: true });
    return;
  }
  const reviewed = mock.find((item) => item.id === id);
  if (reviewed) nextEditVersion(reviewed, expectedVersion);
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
  if (dataSource === "api") return listPublicServiceForms(serviceId);
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
  reviewedForm?: FormTemplate,
): Promise<FormTemplate> {
  const form = reviewedForm ?? await getForm(formId);
  if (!form) throw new NotFoundError("form", formId);
  const has = form.attachedServiceIds.includes(serviceId);
  if (attached === has) return form;
  const attachedServiceIds = attached
    ? [...form.attachedServiceIds, serviceId]
    : form.attachedServiceIds.filter((id) => id !== serviceId);
  return updateForm(formId, { attachedServiceIds }, form.version);
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

export async function listFormPage(filters: import("@/types/page").ListFilter, signal?: AbortSignal): Promise<import("@/types/page").Page<import("@/types/form").FormSummary>> {
  if (dataSource === "mock") {
    const items = mock.filter((item) => (!filters.search || item.name.toLowerCase().includes(filters.search.trim().toLowerCase())) && (filters.status === undefined || filters.status === "all" || item.status === filters.status));
    const states = mock.filter((item) => !filters.search || item.name.toLowerCase().includes(filters.search.trim().toLowerCase())).reduce<Record<string, number>>((counts, item) => { const state = item.status; counts[state] = (counts[state] ?? 0) + 1; return counts; }, {});
    const offset = filters.offset ?? 0;
    return {states, items: items.slice(offset, offset + 25).map((item) => ({id: item.id, name: item.name, description: item.description, status: item.status, fieldCount: item.fields.length, attachedServiceCount: item.attachedServiceIds.length})), total: items.length, limit: 25, offset};
  }
  const params = new URLSearchParams({search: filters.search ?? "", limit: "25", offset: String(filters.offset ?? 0)});
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  const page = await apiRequest<components["schemas"]["FormSummaryPage"]>(`/forms/summaries?${params}`, {signal});
  return {...page, items: page.items.map((item) => ({...item}))};
}


export async function listFormPickerPage(search: string, offset = 0, signal?: AbortSignal) {
  if (dataSource === "api") {
    const page = await apiRequest<FormListDto>(`/forms?status=active&search=${encodeURIComponent(search)}&limit=20&offset=${offset}`, {signal});
    return {...page, items: page.items.map(mapForm)};
  }
  const items = mock.filter((form) => form.status === "active" && form.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return {items: items.slice(offset, offset + 20), total: items.length, limit: 20, offset};
}
