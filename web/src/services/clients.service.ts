import { mockData } from "@/services/adapters/mock-data";
import { readLang } from "@/lib/i18n";
import { nextEditVersion } from "./_editing";

import { apiListAll, apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { makeId } from "@/lib/id";
import type { Client, ClientInput } from "@/types/client";
import { ApiRequestError, NotFoundError, NotImplementedError } from "./_errors";

type ClientDto = components["schemas"]["ClientResponse"];
type ClientListDto = components["schemas"]["ClientListResponse"];
type ClientCreateDto = components["schemas"]["ClientCreate"];
type ClientPatchDto = components["schemas"]["ClientPatch"];

let mock: Client[] = dataSource === "mock" ? mockData("clients") : [] as Client[];
mock = mock.map((item) => ({...item, version: item.version ?? 1}));

function mapClient(client: ClientDto): Client {
  return {
    version: client.version,
    erasedAt: client.erasedAt ?? undefined,
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone ?? undefined,
    company: client.company ?? undefined,
    role: client.role ?? undefined,
    timezone: client.timezone ?? undefined,
    address: client.address ?? undefined,
    vatId: client.vatId ?? undefined,
    tag: client.tag,
    joinedISO: client.createdAt,
    totalBookings: client.totalBookings,
    completedBookings: client.completedBookings,
    cancelledBookings: client.cancelledBookings,
    totalSpentCents: client.totalSpentCents,
  };
}

function createPayload(input: ClientInput): ClientCreateDto {
  return { ...input, vatId: input.vatId ?? null };
}

function patchPayload(patch: Partial<ClientInput>): ClientPatchDto {
  return { ...patch, emailTransferConfirmed: false, vatId: "vatId" in patch ? patch.vatId ?? null : undefined };
}

export async function listClients(): Promise<Client[]> {
  if (dataSource === "api") {
    return (await apiListAll<ClientListDto["items"][number]>("/clients")).map(mapClient);
  }
  await sleep(60);
  return [...mock];
}

export async function getClient(id: string): Promise<Client | null> {
  if (dataSource === "api") {
    try {
      return mapClient(await apiRequest<ClientDto>(`/clients/${encodeURIComponent(id)}`));
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) return null;
      throw error;
    }
  }
  await sleep(40);
  return mock.find((c) => c.id === id) ?? null;
}

export async function createClient(input: ClientInput): Promise<Client> {
  if (dataSource === "api") {
    return mapClient(
      await apiRequest<ClientDto, ClientCreateDto>("/clients", {
        method: "POST",
        body: createPayload(input),
        csrf: true,
      }),
    );
  }
  await sleep(120);
  const created: Client = {
    version: 1,
    ...input,
    id: makeId("cli"),
    joinedISO: new Date().toISOString(),
    tag: "new",
    totalBookings: 0,
    completedBookings: 0,
    cancelledBookings: 0,
    totalSpentCents: 0,
  };
  mock = [created, ...mock];
  return created;
}

export async function updateClient(
  id: string,
  patch: Partial<ClientInput>,
  expectedVersion?: number,
  transfer?: {key: string},
): Promise<Client> {
  if (dataSource === "api") {
    return mapClient(
      await apiRequest<ClientDto, ClientPatchDto>(`/clients/${encodeURIComponent(id)}`, {
        method: "PATCH", expectedVersion,
        body: {...patchPayload(patch), emailTransferConfirmed: !!transfer},
        idempotencyKey: transfer?.key,
        csrf: true,
      }),
    );
  }
  await sleep(100);
  const idx = mock.findIndex((c) => c.id === id);
  if (idx === -1) throw new NotFoundError("client", id);
  const next: Client = { ...mock[idx], ...patch, version: nextEditVersion(mock[idx], expectedVersion) };
  mock = [...mock.slice(0, idx), next, ...mock.slice(idx + 1)];
  return next;
}

export type ClientExport = components["schemas"]["ClientExportResponse"];

/** Everything the workspace holds about one client, for a data access request. */
export async function exportClient(id: string): Promise<ClientExport> {
  if (dataSource !== "api") throw new NotImplementedError("exportClient");
  return apiRequest<ClientExport>(`/clients/${encodeURIComponent(id)}/export`);
}

/**
 * Anonymise a client on request. Bookings keep their amounts and payment state;
 * names, contact details, notes and form answers are removed for good.
 */
export async function eraseClient(id: string, confirmEmail: string, expectedVersion?: number): Promise<void> {
  if (dataSource !== "api") throw new NotImplementedError("eraseClient");
  await apiRequest<void, components["schemas"]["ClientErase"]>(
    `/clients/${encodeURIComponent(id)}/erase`,
    { method: "POST", expectedVersion, body: { confirmEmail }, csrf: true },
  );
}

/** Bounded picker search; full-directory loading remains confined to directory pages. */
export async function searchClients(search: string, signal?: AbortSignal): Promise<Client[]> {
  if (dataSource === "api") {
    return (await apiRequest<ClientListDto>(`/clients?contactable=true&search=${encodeURIComponent(search.trim())}&limit=20&offset=0`, {signal})).items.map(mapClient);
  }
  await sleep(60);
  const query = search.trim().toLowerCase();
  return mock.filter((c) => !c.erasedAt && `${c.name} ${c.email}`.toLowerCase().includes(query)).slice(0, 20);
}

export async function listClientPage(search: string, offset = 0, signal?: AbortSignal): Promise<import("@/types/page").Page<Client>> {
  if (dataSource === "mock") {
    const items = mock.filter((item) => [item.name, item.email, item.company].some((value) => value?.toLowerCase().includes(search.toLowerCase())));
    return {items: items.slice(offset, offset + 25), total: items.length, offset, limit: 25};
  }
  const params = new URLSearchParams({search, offset: String(offset), limit: "25"});
  const page = await apiRequest<ClientListDto>(`/clients?${params}`, {signal});
  return {...page, items: page.items.map(mapClient)};
}

export async function exportClientDirectory(search: string): Promise<string> {
  return apiRequest<string>(`/clients/export.csv?${new URLSearchParams({search, language: readLang()})}`, {responseType: "text"});
}
