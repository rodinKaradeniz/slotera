import servicesJson from "@/data/mock/services.json";
import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { makeId } from "@/lib/id";
import type { Address } from "@/types/address";
import type { Currency } from "@/types/common";
import type { Service, ServiceInput } from "@/types/service";
import { ApiRequestError, NotFoundError } from "./_errors";

type AddressDto = components["schemas"]["Address"];
type ServiceResponseDto = components["schemas"]["ServiceResponse"];
type ServiceListDto = components["schemas"]["ServiceListResponse"];
type ServiceCreateDto = components["schemas"]["ServiceCreate"];
type ServicePatchDto = components["schemas"]["ServicePatch"];

let mock: Service[] = JSON.parse(JSON.stringify(servicesJson)) as Service[];

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
  if (!(["EUR", "USD", "GBP"] as string[]).includes(service.currency)) {
    throw new ApiRequestError(
      200,
      "unsupported_currency",
      `The API returned unsupported currency ${service.currency}.`,
    );
  }
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    durationMin: service.durationMin,
    priceCents: service.priceCents,
    currency: service.currency as Currency,
    capacity: service.capacity,
    locationType: service.locationType,
    location: service.location,
    address: service.address ? mapAddress(service.address) : undefined,
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
    const response = await apiRequest<ServiceListDto>("/services?limit=200");
    return response.items.map(mapService);
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
): Promise<Service> {
  if (dataSource === "api") {
    return mapService(
      await apiRequest<ServiceResponseDto, ServicePatchDto>(
        `/services/${encodeURIComponent(id)}`,
        { method: "PATCH", body: patchPayload(patch), csrf: true },
      ),
    );
  }
  await sleep(100);
  const index = mock.findIndex((service) => service.id === id);
  if (index === -1) throw new NotFoundError("service", id);
  const next: Service = { ...mock[index], ...patch };
  mock = [...mock.slice(0, index), next, ...mock.slice(index + 1)];
  return next;
}

export async function deactivateService(id: string): Promise<Service> {
  return updateService(id, { active: false });
}

export async function activateService(id: string): Promise<Service> {
  return updateService(id, { active: true });
}

export async function removeService(id: string): Promise<void> {
  if (dataSource === "api") {
    await apiRequest<void>(`/services/${encodeURIComponent(id)}`, {
      method: "DELETE",
      csrf: true,
    });
    return;
  }
  await sleep(80);
  mock = mock.filter((service) => service.id !== id);
}
