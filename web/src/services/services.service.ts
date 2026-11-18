import { mockData } from "@/services/adapters/mock-data";
import { nextEditVersion } from "./_editing";

import { apiListAll, apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { makeId } from "@/lib/id";
import type { Address } from "@/types/address";
import type { Service, ServiceInput } from "@/types/service";
import { ApiRequestError, NotFoundError } from "./_errors";
import { apiCurrency } from "./_currency";

type AddressDto = components["schemas"]["Address"];
type ServiceResponseDto = components["schemas"]["ServiceResponse"];
type ServiceListDto = components["schemas"]["ServiceListResponse"];
type ServiceCreateDto = components["schemas"]["ServiceCreate"];
type ServicePatchDto = components["schemas"]["ServicePatch"];

let mock: Service[] = dataSource === "mock" ? mockData("services") : [] as Service[];
mock = mock.map((item) => ({...item, version: item.version ?? 1}));

function mapAddress(address: AddressDto): Address {
  return {
    street: address.street,
    street2: address.street2 ?? undefined,
    city: address.city,
    region: address.region ?? undefined,
    postalCode: address.postalCode,
    country: address.country,
    notes: address.notes ?? undefined,
  };
}

function toAddressDto(address: Address): AddressDto {
  return {
    street: address.street,
    street2: address.street2 || null,
    city: address.city,
    region: address.region || null,
    postalCode: address.postalCode,
    country: address.country,
    notes: address.notes || null,
  };
}

function mapService(service: ServiceResponseDto): Service {
  return {
    version: service.version,
    id: service.id,
    name: service.name,
    description: service.description,
    durationMin: service.durationMin,
    priceCents: service.priceCents,
    currency: apiCurrency(service.currency),
    capacity: service.capacity,
    locationType: service.locationType,
    location: service.location,
    address: service.address ? mapAddress(service.address) : undefined,
    meetingUrl: service.meetingUrl ?? undefined,
    bookingMode: service.bookingMode,
    confirmationPolicy: service.confirmationPolicy,
    cancellationRule: service.cancellationRule,
    active: service.active,
    createdAtISO: service.createdAt,
    notes: service.notes ?? undefined,
  };
}

function createPayload(input: ServiceInput): ServiceCreateDto {
  return {
    name: input.name,
    description: input.description,
    durationMin: input.durationMin,
    priceCents: input.priceCents,
    capacity: input.capacity,
    locationType: input.locationType,
    location: input.location,
    address: input.address ? toAddressDto(input.address) : null,
    meetingUrl: input.meetingUrl?.trim() || null,
    bookingMode: input.bookingMode,
    confirmationPolicy: input.confirmationPolicy,
    cancellationRule: input.cancellationRule,
    active: input.active,
    notes: input.notes ?? null,
  };
}

function patchPayload(patch: Partial<ServiceInput>): ServicePatchDto {
  const payload: ServicePatchDto = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.durationMin !== undefined) payload.durationMin = patch.durationMin;
  if (patch.priceCents !== undefined) payload.priceCents = patch.priceCents;
  if (patch.capacity !== undefined) payload.capacity = patch.capacity;
  if (patch.locationType !== undefined) payload.locationType = patch.locationType;
  if (patch.location !== undefined) payload.location = patch.location;
  if ("address" in patch) {
    payload.address = patch.address ? toAddressDto(patch.address) : null;
  }
  if ("meetingUrl" in patch) payload.meetingUrl = patch.meetingUrl?.trim() || null;
  if (patch.bookingMode !== undefined) payload.bookingMode = patch.bookingMode;
  if (patch.confirmationPolicy !== undefined) {
    payload.confirmationPolicy = patch.confirmationPolicy;
  }
  if (patch.cancellationRule !== undefined) {
    payload.cancellationRule = patch.cancellationRule;
  }
  if (patch.active !== undefined) payload.active = patch.active;
  if ("notes" in patch) payload.notes = patch.notes ?? null;
  return payload;
}

export async function listServices(): Promise<Service[]> {
  if (dataSource === "api") {
    return (await apiListAll<ServiceListDto["items"][number]>("/services")).map(mapService);
  }
  await sleep(60);
  return [...mock];
}

export async function getService(id: string): Promise<Service | null> {
  if (dataSource === "api") {
    try {
      return mapService(
        await apiRequest<ServiceResponseDto>(`/services/${encodeURIComponent(id)}`),
      );
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) return null;
      throw error;
    }
  }
  await sleep(40);
  return mock.find((service) => service.id === id) ?? null;
}

export async function createService(input: ServiceInput): Promise<Service> {
  if (dataSource === "api") {
    return mapService(
      await apiRequest<ServiceResponseDto, ServiceCreateDto>("/services", {
        method: "POST",
        body: createPayload(input),
        csrf: true,
      }),
    );
  }
  await sleep(120);
  const created: Service = {
    version: 1,
    ...input,
    id: makeId("svc"),
    createdAtISO: new Date().toISOString(),
  };
  mock = [created, ...mock];
  return created;
}

export async function updateService(
  id: string,
  patch: Partial<ServiceInput>,
  expectedVersion?: number,
): Promise<Service> {
  if (dataSource === "api") {
    return mapService(
      await apiRequest<ServiceResponseDto, ServicePatchDto>(
        `/services/${encodeURIComponent(id)}`,
        { method: "PATCH", expectedVersion, body: patchPayload(patch), csrf: true },
      ),
    );
  }
  await sleep(100);
  const index = mock.findIndex((service) => service.id === id);
  if (index === -1) throw new NotFoundError("service", id);
  const next: Service = { ...mock[index], ...patch, version: nextEditVersion(mock[index], expectedVersion) };
  mock = [...mock.slice(0, index), next, ...mock.slice(index + 1)];
  return next;
}

export async function deactivateService(id: string, expectedVersion?: number): Promise<Service> {
  return updateService(id, { active: false }, expectedVersion);
}

export async function activateService(id: string, expectedVersion?: number): Promise<Service> {
  return updateService(id, { active: true }, expectedVersion);
}

export async function removeService(id: string,
  expectedVersion?: number,
): Promise<void> {
  if (dataSource === "api") {
    await apiRequest<void>(`/services/${encodeURIComponent(id)}`, {
      method: "DELETE", expectedVersion,
      csrf: true,
    });
    return;
  }
  const reviewed = mock.find((item) => item.id === id);
  if (reviewed) nextEditVersion(reviewed, expectedVersion);
  const [{ listPackages }, { listSessions }, { listForms, setFormServiceAttachment }] = await Promise.all([
    import("./packages.service"), import("./sessions.service"), import("./forms.service"),
  ]);
  if ((await listPackages()).some((offer) => offer.items.some((item) => item.serviceId === id))) {
    throw new ApiRequestError(409, "service_in_package", "Remove this service from its packages before deleting it");
  }
  if ((await listSessions()).some((session) => session.serviceId === id)) {
    throw new ApiRequestError(409, "service_in_use", "This service has sessions or bookings. Deactivate it instead");
  }
  for (const form of await listForms()) {
    if (form.attachedServiceIds.includes(id)) await setFormServiceAttachment(form.id, id, false);
  }
  await sleep(80);
  mock = mock.filter((service) => service.id !== id);
}

export type ServiceOption = Pick<Service, "id" | "name" | "active" | "priceCents" | "currency">;
export async function searchServiceOptions(search: string, signal?: AbortSignal, selectedIds: string[] = [], activeOnly = false, onlySelected = false): Promise<ServiceOption[]> {
  if (dataSource === "mock") {
    const selected = mock.filter((item) => selectedIds.includes(item.id));
    const matches = onlySelected ? [] : mock.filter((item) => (!activeOnly || item.active) && item.name.toLowerCase().includes(search.toLowerCase()) && !selectedIds.includes(item.id)).slice(0, 20);
    return [...selected, ...matches].map(({id, name, active, priceCents, currency}) => ({id, name, active, priceCents, currency}));
  }
  const params = new URLSearchParams({search, activeOnly: String(activeOnly), onlySelected: String(onlySelected)});
  selectedIds.forEach((id) => params.append("selectedIds", id));
  return (await apiRequest<components["schemas"]["ServiceOptionPage"]>(`/services/options?${params}`, {signal})).items.map((item) => ({...item, currency: apiCurrency(item.currency)}));
}
export async function serviceOptionsForIds(ids: string[]): Promise<ServiceOption[]> {
  const unique = [...new Set(ids)];
  const items: ServiceOption[] = [];
  for (let offset = 0; offset < unique.length; offset += 100) {
    items.push(...await searchServiceOptions("", undefined, unique.slice(offset, offset + 100), false, true));
  }
  return items;
}

export async function listServicePage(filters: import("@/types/page").ListFilter, signal?: AbortSignal): Promise<import("@/types/page").Page<Service>> {
  if (dataSource === "mock") {
    const items = mock.filter((item) => (!filters.search || item.name.toLowerCase().includes(filters.search.trim().toLowerCase())) && (filters.status === undefined || filters.status === "all" || (item.active ? "active" : "inactive") === filters.status));
    const states = mock.filter((item) => !filters.search || item.name.toLowerCase().includes(filters.search.trim().toLowerCase())).reduce<Record<string, number>>((counts, item) => { const state = item.active ? "active" : "inactive"; counts[state] = (counts[state] ?? 0) + 1; return counts; }, {});
    const offset = filters.offset ?? 0;
    return {states, items: items.slice(offset, offset + 25), total: items.length, limit: 25, offset};
  }
  const params = new URLSearchParams({search: filters.search ?? "", limit: "25", offset: String(filters.offset ?? 0)});
  if (filters.status && filters.status !== "all") params.set("active", String(filters.status === "active"));
  const page = await apiRequest<components["schemas"]["ServiceListResponse"]>(`/services?${params}`, {signal});
  return {...page, items: page.items.map(mapService)};
}

export async function listServiceSummaryPage(filters: import("@/types/page").ListFilter, signal?: AbortSignal): Promise<import("@/types/page").Page<import("@/types/service").ServiceSummary>> {
  if (dataSource === "mock") return listServicePage(filters);
  const params = new URLSearchParams({search: filters.search ?? "", offset: String(filters.offset ?? 0), limit: "25"});
  if (filters.status && filters.status !== "all") params.set("active", String(filters.status === "active"));
  const page = await apiRequest<components["schemas"]["ServiceSummaryPage"]>(`/services/summaries?${params}`, {signal});
  return {...page, items: page.items.map((item) => ({...item, currency: apiCurrency(item.currency)}))};
}
