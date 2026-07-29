import clientsJson from "@/data/mock/clients.json";
import { apiRequest } from "@/api/client";
import type { components } from "@/api/generated/schema";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { makeId } from "@/lib/id";
import type { Client, ClientInput } from "@/types/client";
import { ApiRequestError, NotFoundError } from "./_errors";

type ClientDto = components["schemas"]["ClientResponse"];
type ClientListDto = components["schemas"]["ClientListResponse"];
type ClientCreateDto = components["schemas"]["ClientCreate"];
type ClientPatchDto = components["schemas"]["ClientPatch"];

let mock: Client[] = JSON.parse(JSON.stringify(clientsJson)) as Client[];

function mapClient(client: ClientDto): Client {
  return {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone ?? undefined,
    company: client.company ?? undefined,
    role: client.role ?? undefined,
    timezone: client.timezone ?? undefined,
    address: client.address ?? undefined,
    vatId: client.vatId ?? undefined,
    tag: "new",
    joinedISO: client.createdAt,
    totalBookings: 0,
    completedBookings: 0,
    cancelledBookings: 0,
    totalSpentCents: 0,
  };
}

function createPayload(input: ClientInput): ClientCreateDto {
  return { ...input, vatId: input.vatId ?? null };
}

function patchPayload(patch: Partial<ClientInput>): ClientPatchDto {
  return { ...patch, vatId: "vatId" in patch ? patch.vatId ?? null : undefined };
}

export async function listClients(): Promise<Client[]> {
  if (dataSource === "api") {
    const response = await apiRequest<ClientListDto>("/clients?limit=200");
    return response.items.map(mapClient);
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
): Promise<Client> {
  if (dataSource === "api") {
    return mapClient(
      await apiRequest<ClientDto, ClientPatchDto>(`/clients/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: patchPayload(patch),
        csrf: true,
      }),
    );
  }
  await sleep(100);
  const idx = mock.findIndex((c) => c.id === id);
  if (idx === -1) throw new NotFoundError("client", id);
  const next: Client = { ...mock[idx], ...patch };
  mock = [...mock.slice(0, idx), next, ...mock.slice(idx + 1)];
  return next;
}
