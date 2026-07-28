import settingsJson from "@/data/mock/settings.json";
import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { makeId } from "@/lib/id";
import type { Address, WorkspaceLocation } from "@/types/address";
import type { SettingsData } from "@/types/settings";
import { NotFoundError, NotImplementedError } from "./_errors";

type AddressDto = components["schemas"]["Address"];
type BusinessResponseDto = components["schemas"]["BusinessSettingsResponse"];
type BusinessPatchDto = components["schemas"]["BusinessSettingsPatch"];
type LocationResponseDto = components["schemas"]["WorkspaceLocationResponse"];
type LocationCreateDto = components["schemas"]["WorkspaceLocationCreate"];
type LocationPatchDto = components["schemas"]["WorkspaceLocationPatch"];
type LocationListDto = components["schemas"]["WorkspaceLocationListResponse"];

export type BusinessSettings = SettingsData["business"];

let mock: SettingsData = JSON.parse(JSON.stringify(settingsJson)) as SettingsData;

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

function mapLocation(location: LocationResponseDto): WorkspaceLocation {
  return {
    id: location.id,
    label: location.label,
    address: mapAddress(location.address),
  };
}

function mapBusiness(
  business: BusinessResponseDto,
  locations: WorkspaceLocation[],
): BusinessSettings {
  return {
    name: business.name,
    displayName: business.displayName,
    bio: business.bio,
    email: business.email,
    phone: business.phone,
    address: business.address,
    bookingPageUrl: business.slug,
    bookingPageEnabled: business.bookingPageEnabled,
    locations,
  };
}

export async function getSettings(): Promise<SettingsData> {
  if (dataSource !== "mock") throw new NotImplementedError("getSettings");
  await sleep(60);
  return mock;
}

export async function updateSettings(
  patch: Partial<SettingsData>,
): Promise<SettingsData> {
  if (dataSource !== "mock") throw new NotImplementedError("updateSettings");
  await sleep(120);
  mock = { ...mock, ...patch } as SettingsData;
  return mock;
}

export async function getBusinessSettings(): Promise<BusinessSettings> {
  if (dataSource === "mock") {
    await sleep(60);
    return mock.business;
  }
  const [business, locations] = await Promise.all([
    apiRequest<BusinessResponseDto>("/settings/business"),
    listWorkspaceLocations(),
  ]);
  return mapBusiness(business, locations);
}

export async function updateBusinessSettings(
  patch: Partial<BusinessSettings>,
): Promise<BusinessSettings> {
  if (dataSource === "mock") {
    await sleep(120);
    mock = { ...mock, business: { ...mock.business, ...patch } };
    return mock.business;
  }
  const payload: BusinessPatchDto = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.displayName !== undefined) payload.displayName = patch.displayName;
  if (patch.bio !== undefined) payload.bio = patch.bio;
  if (patch.email !== undefined) payload.email = patch.email;
  if (patch.phone !== undefined) payload.phone = patch.phone;
  if (patch.address !== undefined) payload.address = patch.address;
  if (patch.bookingPageEnabled !== undefined) {
    payload.bookingPageEnabled = patch.bookingPageEnabled;
  }
  const [business, locations] = await Promise.all([
    apiRequest<BusinessResponseDto, BusinessPatchDto>("/settings/business", {
      method: "PATCH",
      body: payload,
      csrf: true,
    }),
    listWorkspaceLocations(),
  ]);
  return mapBusiness(business, locations);
}

export async function listWorkspaceLocations(): Promise<WorkspaceLocation[]> {
  if (dataSource === "mock") {
    await sleep(40);
    return [...mock.business.locations];
  }
  const response = await apiRequest<LocationListDto>("/settings/locations");
  return response.items.map(mapLocation);
}

export async function createWorkspaceLocation(
  input: Omit<WorkspaceLocation, "id">,
): Promise<WorkspaceLocation> {
  if (dataSource === "mock") {
    await sleep(100);
    const created = { ...input, id: makeId("loc") };
    mock = {
      ...mock,
      business: {
        ...mock.business,
        locations: [...mock.business.locations, created],
      },
    };
    return created;
  }
  const payload: LocationCreateDto = {
    label: input.label,
    address: toAddressDto(input.address),
  };
  const response = await apiRequest<LocationResponseDto, LocationCreateDto>(
    "/settings/locations",
    { method: "POST", body: payload, csrf: true },
  );
  return mapLocation(response);
}

export async function updateWorkspaceLocation(
  id: string,
  patch: Omit<WorkspaceLocation, "id">,
): Promise<WorkspaceLocation> {
  if (dataSource === "mock") {
    await sleep(100);
    const index = mock.business.locations.findIndex((item) => item.id === id);
    if (index === -1) throw new NotFoundError("location", id);
    const updated = { id, ...patch };
    const locations = [...mock.business.locations];
    locations[index] = updated;
    mock = { ...mock, business: { ...mock.business, locations } };
    return updated;
  }
  const payload: LocationPatchDto = {
    label: patch.label,
    address: toAddressDto(patch.address),
  };
  const response = await apiRequest<LocationResponseDto, LocationPatchDto>(
    `/settings/locations/${encodeURIComponent(id)}`,
    { method: "PATCH", body: payload, csrf: true },
  );
  return mapLocation(response);
}

export async function deleteWorkspaceLocation(id: string): Promise<void> {
  if (dataSource === "mock") {
    await sleep(80);
    const before = mock.business.locations.length;
    const locations = mock.business.locations.filter((item) => item.id !== id);
    if (locations.length === before) throw new NotFoundError("location", id);
    mock = { ...mock, business: { ...mock.business, locations } };
    return;
  }
  await apiRequest<void>(`/settings/locations/${encodeURIComponent(id)}`, {
    method: "DELETE",
    csrf: true,
  });
}
